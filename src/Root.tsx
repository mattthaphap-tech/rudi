import React from "react";
import { Composition, Audio, AbsoluteFill, staticFile } from "remotion";
import { RudiShort, RUDI_FRAMES } from "./videos/rudi/Rudi";

/** the picture + the finished mix (voice + score + SFX, public/rudi/mix.wav, built by audio/build.py). Stills ignore the audio. */
const WithVoice: React.FC = () => (
  <AbsoluteFill>
    <RudiShort />
    <Audio src={staticFile("rudi/mix.wav")} />
  </AbsoluteFill>
);
export const Root: React.FC = () => (
  <>
    <Composition id="RudiShort" component={WithVoice} durationInFrames={RUDI_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
