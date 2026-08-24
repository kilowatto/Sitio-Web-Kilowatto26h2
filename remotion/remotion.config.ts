import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
// 9:16 for X, LinkedIn and every vertical surface. Set on the composition too; this is the
// encoder side.
Config.setCodec("h264");
Config.setCrf(20);
