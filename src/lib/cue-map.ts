import type { AlignedWord } from "./elevenlabs";

// Builds the paragraph-level sync map: which <p> of the rendered article is being spoken at
// which second.
//
// Why paragraph level and not word level: the narration follows an ADAPTED script, not the
// article verbatim. Measured on a real piece, the model keeps ~90% of the words and all of the
// order but merges sentences and adds connectors ("...de su carrera, MIENTRAS QUE el otro
// grupo..."). That is more than enough drift to land a word-level highlight on the wrong word.
// Paragraphs survive the adaptation intact, so that is the granularity that can be trusted.
//
// Matching is by content, not by position: the script carries an intro (title + standfirst) and
// spoken section headings that have no 1:1 counterpart among the article's <p> elements, so
// index alignment would be off by a varying amount. Comparing word sets is robust to exactly
// the kind of light editing the adaptation performs.

export interface Cue {
  p: number; // zero-based index of the <p> in the article body
  start: number;
  end: number;
}

const STOPWORDS = new Set([
  "de","la","que","el","en","y","a","los","del","se","las","por","un","para","con","no","una",
  "su","al","lo","como","mas","más","o","pero","sus","le","ya","este","si","porque","esta","son",
]);

// Content words only. Stopwords are so frequent that they swamp the similarity score and make
// every paragraph look alike.
function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// Jaccard-style overlap, biased toward the script paragraph: we care how much of what was
// SPOKEN appears in the candidate article paragraph.
function similarity(scriptWords: string[], articleWords: string[]): number {
  if (scriptWords.length === 0 || articleWords.length === 0) return 0;
  const articleSet = new Set(articleWords);
  let hits = 0;
  for (const w of scriptWords) if (articleSet.has(w)) hits++;
  return hits / scriptWords.length;
}

// Anchor-based alignment.
//
// The first implementation split the SCRIPT on its <break> tags and matched each piece to an
// article paragraph. It averaged 25% coverage, with several articles at 0%, for a structural
// reason: narration generated before the prosody work has no break tags at all, so the whole
// script collapsed into one "paragraph" and nothing could match. Depending on a formatting
// artifact of the script was the wrong axis.
//
// This walks the timed word stream instead and, for each ARTICLE paragraph in order, looks for
// the position where that paragraph's opening words actually occur. Article paragraphs are what
// we need to time, the word stream is ground truth for when things were said, and neither
// depends on how the script happened to be punctuated.

function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]/g, "");
}

// Finds where `anchor` (a paragraph's opening content words) appears in the word stream at or
// after `from`. Returns -1 when no position is convincing enough.
function findAnchor(stream: string[], anchor: string[], from: number): number {
  if (anchor.length === 0) return -1;
  const need = Math.max(2, Math.ceil(anchor.length * 0.5));
  const window = anchor.length * 4; // room for inserted connectors and merged clauses

  for (let i = from; i < stream.length; i++) {
    if (stream[i] !== anchor[0]) continue;
    // Count how many anchor words show up, in order, within a short window after i.
    let hits = 1;
    let cursor = i + 1;
    for (let a = 1; a < anchor.length && cursor < stream.length && cursor < i + window; a++) {
      for (let j = cursor; j < Math.min(stream.length, i + window); j++) {
        if (stream[j] === anchor[a]) { hits++; cursor = j + 1; break; }
      }
    }
    if (hits >= need) return i;
  }
  return -1;
}

// `articleParagraphs` is the plain text of each <p> in the rendered body, in document order.
export function buildCueMap(
  _script: string,
  words: AlignedWord[],
  articleParagraphs: string[]
): Cue[] {
  if (words.length === 0 || articleParagraphs.length === 0) return [];

  const stream = words.map((w) => normalizeWord(w.text)).map((w) => w || "\u0000");

  type Hit = { p: number; wordIndex: number; length: number };
  const hits: Hit[] = [];
  let cursor = 0;

  for (let p = 0; p < articleParagraphs.length; p++) {
    const content = contentWords(articleParagraphs[p]).map(normalizeWord).filter(Boolean);
    if (content.length < 4) continue; // too short to anchor on without false positives

    const anchor = content.slice(0, 8);
    const at = findAnchor(stream, anchor, cursor);
    if (at < 0) continue;

    hits.push({ p, wordIndex: at, length: content.length });
    // Narration never goes backwards, so the next paragraph starts at least one word later.
    cursor = at + 1;
  }

  // A paragraph runs until the next matched paragraph begins; the last one runs to the end.
  const cues: Cue[] = [];
  for (let i = 0; i < hits.length; i++) {
    const start = words[hits[i].wordIndex].start;
    const endIdx = i + 1 < hits.length ? hits[i + 1].wordIndex - 1 : words.length - 1;
    const end = words[Math.max(hits[i].wordIndex, endIdx)].end;
    if (end > start) cues.push({ p: hits[i].p, start, end });
  }

  return cues;
}
