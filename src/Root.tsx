import React from "react";
import { Composition, Audio, AbsoluteFill, staticFile } from "remotion";
import { RudiShort, RUDI_FRAMES } from "./videos/rudi/Rudi";

/** the picture + the supplied voice track (public/rudi/voice.mp3). Stills ignore the audio. */
const WithVoice: React.FC = () => (
  <AbsoluteFill>
    <RudiShort />
    <Audio src={staticFile("rudi/voice.mp3")} />
  </AbsoluteFill>
);
export const Root: React.FC = () => (
  <>
    <Composition id="RudiShort" component={WithVoice} durationInFrames={RUDI_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
