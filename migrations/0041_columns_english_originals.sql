-- Human-written English versions for the 4 bilingual columns + Frida Café, inserted
-- directly (source='human') so the AI translator (api/translate.ts) never overwrites
-- them -- it only fills in the OTHER 10 non-canonical locales for these rows.

INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source, reviewed)
SELECT 'columns', id, 'en', 'title', 'The Internet is "Too Big to Fail": The Dangerous Comfort of Centralization', 'human', 1 FROM columns WHERE slug = 'internet-too-big-to-fail';

INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source, reviewed)
SELECT 'columns', id, 'en', 'body_html', '<p>Yesterday, the corporate world held its breath once again. A massive Microsoft 365 outage left thousands of companies and millions of users staring at error screens instead of working.</p>
<p>It wasn’t just about not being able to send an email or co-author an Excel sheet. The impact was far deeper and revealed our systemic fragility: Microsoft Teams, which today functions as the de facto PBX for countless organizations, left contact centers dead silent. Support lines were cut. Even more critically, the failure in email delivery systems prevented millions of users from receiving One-Time Passwords (OTPs).</p>
<p>Suddenly, you couldn’t log into your bank, you couldn’t validate a movie ticket purchase, you couldn’t sign documents. All because a single company, somewhere in "the cloud," had a bad day.</p>
<h2>The "No-Brainer" Trap</h2>
<p>I have spoken many times in this space about the risks of technological concentration, but incidents like yesterday’s force us to be more vocal.</p>
<p>Most people are unaware that the Internet—a network born with the promise of being decentralized and indestructible—now hangs by four or five very thick threads. And I don’t blame them. For Chief Technology Officers (CTOs) and consultants like myself, choosing these giants has been, for years, an obvious choice; a no-brainer.</p>
<p>I myself have migrated hundreds of domains to Cloudflare, set up thousands of mailboxes on Google Workspace and Microsoft 365, and deployed critical infrastructure on AWS. Why? Because they are cheap, innovative, and, most of the time, they work incredibly well. They are unbeatable allies of efficiency.</p>
<h2>The Private Cloud Illusion</h2>
<p>The problem arises when we believe we can isolate ourselves from the risk. I’ve heard many colleagues say: "That’s why I have my own private cloud, so I don’t depend on anyone."</p>
<p>I hate to burst that bubble, but it’s an illusion. Even if you have your servers in your own basement, it is highly likely that your system consumes third-party APIs, uses public DNS, or requires libraries that depend on this concentrated infrastructure.</p>
<p>If Cloudflare goes down, half of the applications your "private cloud" needs to talk to the outside world will stop responding. If AWS has a failure in the us-east-1 region, authentication services, payment gateways, or logistics systems you rely on will stop working. When these giants sneeze, your system—no matter how private—catches pneumonia. It is a systemic, invisible, and terrifying dependency.</p>
<h2>The Lords of the Cable</h2>
<p>To size up the problem, let’s look at who really holds up 99.99% of the Internet:</p>
<ul>
<li>The Cloud (Infrastructure): Just three companies (Amazon AWS, Microsoft Azure, and Google Cloud) control about 67% of the entire global cloud infrastructure market. If we add Alibaba, the figure exceeds 75%. The rest of the world fights for the crumbs.</li>
<li>Web Traffic (CDN &amp; Security): Cloudflare has become the doorman of the Internet. About 20% of all websites in the world and nearly 80% of those using a Content Delivery Network (CDN) depend on them. If Cloudflare unplugs a cable, a fifth of the web instantly vanishes.</li>
<li>The Backbone (Tier 1 ISPs): Behind the clouds are the carriers. Companies like Cogent, Lumen (formerly CenturyLink), and Telia own the main highways. There are very few of them. When one fails (as happened with Cogent a few years ago), global routing breaks, and entire countries suffer latency or disconnection.</li>
</ul>
<h2>Public Policy or Strategic Diversification?</h2>
<p>Yesterday''s Microsoft blackout is a reminder that we have put all the eggs of the digital economy into very few baskets.</p>
<p>This brings us to an urgent crossroads. Should we start discussing a global antitrust public policy to avoid this systemic concentration and force a return to the Internet’s original, distributed architecture? That is a difficult and politically complex path.</p>
<p>Or, does the solution lie in the hands of tech decision-makers? Perhaps the time has come to stop blindly consuming the "number one" by default. Maybe the real resilience strategy for 2026 is to bet on provider number 3, 4, or 5. To look toward regional data centers, to bet on niche cloud providers that, while they may not have a thousand features, offer sovereignty and diversification.</p>
<p>Continuing to feed the giants is comfortable and cheap, until one random Tuesday, a failed update in Redmond or Northern Virginia flips the switch on your business, and you realize the control was never yours.</p>', 'human', 1 FROM columns WHERE slug = 'internet-too-big-to-fail';

INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source, reviewed)
SELECT 'columns', id, 'en', 'title', 'While the World Scrolls, a Giant Moves: Artemis II and the Path to Mars', 'human', 1 FROM columns WHERE slug = 'artemis-ii';

INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source, reviewed)
SELECT 'columns', id, 'en', 'body_html', '<p>We live in an era of attention deficit. Between the latest political scandal, stock market fluctuations, and the relentless noise of social media, we often let the events that will truly define the future of our species slip by. We are so busy looking down at our screens that we forget to look up.</p>
<p>This past Saturday, while the news cycle shredded the ephemeral, something historic happened at Cape Canaveral. In an operation that lasted nearly 12 hours, a colossus of metal and technology moved agonizingly slowly toward Launch Pad 39B.</p>
<p>It is the rocket for the Artemis II mission. And although its journey was just a few miles atop NASA’s legendary crawler-transporter, that rollout symbolizes that humanity''s return to the Moon has moved from a PowerPoint presentation to real, vertical hardware ready for a countdown.</p>
<h2>SLS and Orion: The Interplanetary Uber</h2>
<p>To understand why this matters, you have to understand what we are looking at. This isn''t just another commercial rocket sending satellites into low orbit.</p>
<p>What moved this weekend is the SLS (Space Launch System), the most powerful rocket NASA has ever built. Unlike commercial rockets, the SLS is designed with one brutal purpose: to generate the raw force needed to break the chains of Earth''s gravity and push heavy payloads into deep space.</p>
<p>At the tip of that spear rides the Orion spacecraft. If the SLS is the muscle, Orion is the shield and the brain. It is the capsule designed to keep four astronauts alive in the most hostile environment imaginable, far beyond Earth''s magnetic protection, where radiation is lethal and the margin for error is zero.</p>
<p>And this time, Uncle Sam isn''t going alone. Unlike the Apollo era, this is an integrated multinational effort. The service module that powers, propels, and provides life support to Orion isn''t American; it is the work of the European Space Agency (ESA). Likewise, the Canadian Space Agency (CSA) is a critical partner that has already secured a seat for one of its astronauts (Jeremy Hansen) on this mission. It is the validation that the 21st-century space frontier is conquered in coalition, not in solitude.</p>
<h2>Beyond the Footprint: Mining and Compute</h2>
<p>I recently wrote in this space about the concept of the "Over Cloud" and orbital data centers. I spoke of servers in space powered by infinite solar energy. Many saw it as distant science fiction.</p>
<p>But missions like Artemis II are the foundation of that reality. We are not returning to the Moon out of 1960s nostalgia, nor just to plant another flag. The strategic objective is to stay.</p>
<p>The Moon is our mandatory sandbox. If we dream of reaching Mars, we first have to learn how to live on the Moon. If we dream of space mining—extracting Helium-3 for nuclear fusion or rare earths from asteroids—we need a service station in lunar orbit. The Moon is not the final destination; it is the port of departure for the solar system.</p>
<p>Without Artemis, there is no lunar base. Without a lunar base, there is no asteroid mining. And without space mining, Earth''s economy will remain limited by the finite resources of our crust.</p>
<p>Windows of Opportunity (and Physics)</p>
<p>Although seeing the rocket on the pad is thrilling, the reality is that challenges remain. The Artemis II mission will not land; it will be a crewed flyby (similar to Apollo 8) to prove that humans can survive the journey in Orion.</p>
<p>And here enters the coldness of astrophysics. We cannot launch whenever we want. NASA has not given an exact date, but a calendar of "launch windows."</p>
<p>Unlike a flight to New York, going to the Moon requires a perfect alignment of orbital mechanics: the position of Earth, the location of the Moon, and the rocket''s capacity must synchronize to ensure not only the outbound trip but a safe return and adequate solar lighting for Orion''s panels. These windows open and close for days or weeks. Missing a window means waiting for the cosmic waltz to align again.</p>
<p>Saturday''s rollout was a physical and tangible reminder. While we argue about the day-to-day grind, thousands of engineers—American, European, and Canadian—are moving, inch by inch, the machinery that will finally make us a multi-planetary species.</p>
<p>It is worth looking up from the screen for a moment to see it.</p>', 'human', 1 FROM columns WHERE slug = 'artemis-ii';

INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source, reviewed)
SELECT 'columns', id, 'en', 'title', 'The AI Glass Ceiling: The Invisible Crisis That Could Freeze Your 2026', 'human', 1 FROM columns WHERE slug = 'techo-de-cristal-de-la-ia';

INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source, reviewed)
SELECT 'columns', id, 'en', 'body_html', '<p>A few days ago, I wrote here about how memory manufacturers (RAM and SSD) are turning off the faucet for the consumer market to feed data centers. I warned about hardware’s “VIP club,” and why 2026 could be a year defined by shortages. But if you thought the problem ended with memory chips, I’ve got bad news. There’s a deeper bottleneck—more physical, more stubborn, and far harder to fix. We’re not talking about silicon. Not power. Not water. We’re talking about glass.</p>
<p>Specifically: ultra-high-purity quartz glass and specialized glass cloth—materials that quite literally hold up the digital brain of the world. And just like with memory, NVIDIA and the AI giants are already drinking the supply dry.</p>
<h2>Sand Isn’t Infinite</h2>
<p>To most people, glass is just melted sand: common, cheap, everywhere. But at the nanoscale, ordinary glass is basically junk. To make the advanced semiconductors that power AI (think NVIDIA’s Blackwell family or Apple’s M4), the industry relies on quartz crucibles so pure that the raw material comes from only a handful of places on Earth—most notably Spruce Pine, North Carolina—or is produced through extremely expensive synthetic processes, particularly in Japan.</p>
<p>Without those crucibles, you can’t melt silicon cleanly enough to produce leading-edge wafers. But the pain point right now is even more specific: packaging.</p>
<p>Modern AI chips aren’t single slabs of silicon. They’re skyscrapers—stacked components assembled through advanced packaging (like TSMC’s CoWoS). To keep those skyscrapers from warping, cracking, or overheating, they need to be mounted on substrates made from a very particular material: low-CTE (low coefficient of thermal expansion) fiberglass. And this is where the chain starts to break.</p>
<h2>The Japanese Bottleneck: Nittobo</h2>
<p>A huge share of the world’s supply of this specialized glass depends on one company in Japan: Nitto Boseki (Nittobo). Recent market intelligence paints a stark picture: demand for NVIDIA’s AI accelerators has effectively absorbed most of Nittobo’s production capacity for the next two years. Hyperscalers—Google, Microsoft, Meta—have reportedly locked up entire production lines, paying premiums no consumer electronics maker can match.</p>
<p>That has triggered a quiet kind of panic in Cupertino. Reports suggest Apple—arguably the most formidable supply-chain organization on the planet—has had to send executives to Japan to plead for allocation. At the same time, Apple appears to be urgently scouting alternatives in China, leaning on smaller suppliers like Grace Fabric, trying to push them to meet Apple-grade standards at breakneck speed.</p>
<p>If Apple is struggling to secure glass, what chance does everyone else have?</p>
<h2>The Domino Effect in 2026</h2>
<p>This brings me back to the central thesis: AI is cannibalizing the rest of technology. The glass that should be going into substrates for 2026 laptops, mainstream enterprise servers, and smartphones is being diverted to package H100-class GPUs and the next wave of Blackwell systems.</p>
<p>That means we may face a structural shortage of foundational components next year. It won’t be that there are no CPUs. It’ll be that there aren’t enough of the boards and substrates needed to mount and ship complete systems. Here’s what that can translate into:</p>
<ul>
<li>Delayed launches: Consumer products slipping by months.</li>
<li>Hardware inflation: Higher prices for PCBs and motherboards flowing into server and PC prices.</li>
<li>Compromised quality: Second-tier brands taking risks with lower-grade substrates (higher thermal expansion), leading to systems that fail sooner.</li>
</ul>
<h2>The Physical Fragility of the Digital World</h2>
<p>It’s both fascinating and unsettling: we’ve built a multi-trillion-dollar digital economy that can be throttled by whether a factory in Japan can spin specialty glass fast enough. NVIDIA didn’t lock up supply out of malice. It did it out of survival and market gravity. They secured their future—while the rest of the industry fights over the remaining shards. So when your IT vendor tells you in 2026 that servers are backordered—or that laptops are suddenly 20% more expensive because of “supply chain issues”—don’t just think chips.</p>
<p>Think glass.</p>
<p>AI isn’t only consuming our power and our memory. It may also be consuming the very substrate—the literal foundation—on which modern computing is built.</p>', 'human', 1 FROM columns WHERE slug = 'techo-de-cristal-de-la-ia';

INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source, reviewed)
SELECT 'columns', id, 'en', 'title', 'Dr. GPT Will See You Now: Why "AI Triage" Should Be Public Policy, Not a Guilty Secret', 'human', 1 FROM columns WHERE slug = 'dr-gpt-te-atendera-ahora';

INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source, reviewed)
SELECT 'columns', id, 'en', 'body_html', '<p>While the medical elite marvels at Artificial Intelligence’s ability to detect pancreatic cancer or fold proteins in record time, a much quieter, yet massive revolution is happening on the streets—or rather, on the screens. Millions of Americans have graduated from "Dr. Google" and WebMD anxiety spirals; they are now having full-blown consultations with chatbots.</p>
<p>Whether via ChatGPT , Claude, or AI at Meta , the average user is turning the chatbot into their de facto primary care physician for everyday ailments. "I ate spicy wings and my chest burns, what should I take?", "My toddler has a runny nose but no fever, is it allergies?".</p>
<p>The knee-jerk reaction from the American Medical Association Foundation (AMA) and regulators is rejection: "AI hallucinates," "it’s dangerous," "it encourages self-medication." And they are right about the risks. However, denying this reality is like trying to hold back the tide with a broom. The phenomenon is here, it is scaling, and it is unstoppable.</p>
<h2>The Elephant in the Waiting Room</h2>
<p>Let’s be blunt: prohibition doesn''t work. Even if ethical companies like OpenAI or Google place "guardrails" to prevent prescribing controlled substances, the open-source ecosystem and models hosted in jurisdictions with different values will ensure there is always an AI willing to answer. We cannot legislate to ban the algorithm, but we can legislate to channel it.</p>
<p>I propose we stop viewing this as a threat and start seeing it as a public health tool to solve a chronic American crisis: the collapse of primary care access.</p>
<p>The United States is facing a breaking point. The American Association of Veterinary Medical Colleges (AAMC) projects a shortage of up to 86,000 physicians by 2036. In rural "medical deserts," the situation is already dire. Even in wealthy suburbs, getting an appointment with a General Practitioner can take weeks, and a visit to an Urgent Care for a simple sore throat can result in a $200 bill—even with insurance.</p>
<p>A massive volume of these medical interactions are "low complexity": common colds, mild indigestion, tension headaches. Cases that are historically resolved with rest, hydration, and Over-The-Counter (OTC) medications like ibuprofen or omeprazole.</p>
<h2>A National Digital Triage</h2>
<p>What if the FDA or the CDC, instead of fighting the current, certified or developed a standard for "AI-Assisted National Triage"?</p>
<p>Imagine a system validated by health authorities that allows citizens to query minor symptoms. An AI that doesn’t "hallucinate," but is strictly bounded by medical protocols to suggest OTC medications in an orderly fashion, with correct dosages and clear "red flags."</p>
<p>If the AI detects symptoms of something serious—appendicitis, heart attack, severe dehydration—it immediately directs the user to the ER or 911. But if it’s just heartburn, it suggests the right antacid, saving the patient a co-pay and freeing up a slot in the clinic for someone who is actually dying.</p>
<p>This isn’t science fiction. A study by the University of California San Diego (UCSD) published in JAMA Internal Medicine compared responses from physicians and ChatGPT to patient questions. Shockingly, evaluators preferred the AI''s response 79% of the time, rating it not only as accurate but more empathetic and detailed than busy doctors rushing through 15-minute slots.</p>
<h2>The Opportunity for the Coming Decade</h2>
<p>The risk of doing nothing is that people will use unregulated, "jailbroken" models and end up taking dangerous advice. The risk of doing it right is... solving the bottleneck of frontline healthcare.</p>
<p>The "MinuteClinics" at CVS or Walgreens were a physical patch for this problem. AI on your smartphone is the logical digital evolution.</p>
<p>We need lawmakers to craft public policy for "AI-Assisted Self-Care for Minor Ailments." We need official databases, digital "seals of approval" for medical algorithms, and public education so the population knows when to trust the bot and when to run to the hospital.</p>
<p>Technology will never replace the warmth of a family doctor. But when that doctor is fully booked for three weeks, or out of network, or simply too expensive, a well-trained AI that tells you: "Take acetaminophen every 6 hours and stay hydrated," isn''t a technological dystopia. For millions of Americans, it is the only path to immediate, dignified, and affordable health guidance.</p>', 'human', 1 FROM columns WHERE slug = 'dr-gpt-te-atendera-ahora';

INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source, reviewed)
SELECT 'columns', id, 'en', 'title', 'Why I Invested in Frida Café', 'human', 1 FROM columns WHERE slug = 'frida-cafe';

INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source, reviewed)
SELECT 'columns', id, 'en', 'body_html', '<p>Investing in Frida Café has been one of the most fulfilling decisions I’ve made. Not just because coffee is one of my greatest passions, but because this project represents tradition, health, sustainability, and a direct impact on Mexico’s coffee-growing communities.</p>
<p>Frida Café is not just coffee. It’s waking up to the rich aroma of freshly ground beans, it’s the first sip that kickstarts your day, the perfect excuse for a great conversation, or a moment of solitude with an amazing cup.</p>
<h2>Coffee and Its Health Benefits ☕💪</h2>
<p>Beyond taste, coffee has powerful health benefits, and science has backed this up over the years:</p>
<p>✅ Rich in Antioxidants: Protects against aging and cell damage.</p>
<p>✅ Boosts Concentration &amp; Memory: Caffeine naturally stimulates the nervous system.</p>
<p>✅ Reduces Risk of Neurodegenerative Diseases: Studies link coffee consumption with lower risks of Alzheimer’s and Parkinson’s.</p>
<p>✅ Speeds Up Metabolism &amp; Fat Burning: Ideal for those looking to stay active.</p>
<p>✅ Promotes Longevity: Regular coffee drinkers tend to live longer.</p>
<p>But not all coffee is created equal. The quality, origin, and production process make the difference between an ordinary coffee and an extraordinary one.</p>
<h2>Mexico: A Coffee Powerhouse 🇲🇽🌎</h2>
<p>When people think of high-quality coffee, they often mention Colombia or Brazil. But Mexico is a giant in specialty coffee production.</p>
<p>📍 Top Coffee-Growing Regions in Mexico:</p>
<p>🌱 Veracruz: Balanced, with fruity and sweet notes.</p>
<p>🌱 Chiapas: The highest-quality Mexican coffee, known for its intense body and bright acidity.</p>
<p>🌱 Puebla: Floral and chocolatey notes, ideal for specialty coffee lovers.</p>
<p>🌱 Oaxaca: Smooth, with chocolate and spice undertones, grown by indigenous communities.</p>
<p>Mexico’s coffee industry supports over 500,000 producers, most of whom are small-scale farmers passing down their knowledge through generations.</p>
<p>For me, investing in Frida Café is more than business—it’s a commitment to Mexican culture, sustainability, and empowering local communities.</p>
<h2>Sustainability: More Than a Buzzword 🌱🌍</h2>
<p>One of the pillars of Frida Café is environmental responsibility. While mass coffee production is causing deforestation and biodiversity loss, we take a 100% organic, sustainable approach:</p>
<p>🌿 No pesticides or synthetic fertilizers.</p>
<p>🌿 Shade-grown coffee to protect biodiversity.</p>
<p>🌿 Water conservation practices.</p>
<p>🌿 Fair trade pricing to support farmers.</p>
<p>Every cup of Frida Café is a conscious choice that supports sustainability.</p>
<h2>The Dream Team Behind Frida Café 🚀☕</h2>
<p>Great businesses are built by great teams. When I decided to invest in Frida Café, I knew it wasn’t just about the coffee—it was about the people.</p>
<p>A key part of this journey has been Jerónimo, our CEO and operations director. His passion, hard work, and vision have been fundamental in positioning Frida Café in a highly competitive market.</p>
<p>💡 Strategy, execution, and passion are key. Selling coffee is not just about pushing a product—it’s about building a brand with purpose.</p>
<h2>Frida Kahlo: More Than a Name, A Mexican Icon 🎨🇲🇽</h2>
<p>The name Frida Café is no coincidence. Frida Kahlo is a global icon of resilience, art, and Mexican culture. Every bag of coffee we send out carries not only an exceptional product but also a piece of our history and identity.</p>
<h2>Okay… Let’s Talk About Ego 😌☕</h2>
<p>I won’t lie. There’s something deeply satisfying about hearing people rave about a product I’ve invested in.</p>
<p>📲 "Hey, this coffee is amazing!"</p>
<p>📲 "My mom tried it and she LOVED it!"</p>
<p>📲 "I’ve never had coffee this good before."</p>
<p>That feeling never gets old. Knowing that something I believe in is making an impact in people’s lives is priceless.</p>
<h2>Investing in Passion &amp; Quality 🚀</h2>
<p>Betting on Frida Café was an easy decision. Not just because I love coffee, but because I believe in what it represents: ✔️ A premium-quality product. ✔️ A positive impact on small farmers and communities. ✔️ A connection to Mexican history and culture. ✔️ A truly unforgettable experience in every cup.</p>
<p>This is just the beginning. I’ll continue to support Frida Café, just as I do with all my investments, because this is about more than coffee—it’s about identity, sustainability, and a commitment to Mexico.</p>
<p>https://fridacafe.mx/</p>', 'human', 1 FROM columns WHERE slug = 'frida-cafe';
