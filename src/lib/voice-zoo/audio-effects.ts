import type { ObjectType } from "@/types/garden";

type BrowserAudioContext = {
  decodeAudioData: (audioData: ArrayBuffer) => Promise<AudioBuffer>;
  close: () => Promise<void>;
};

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
  webkitOfflineAudioContext?: typeof OfflineAudioContext;
};

const MIN_EFFECT_OUTPUT_PEAK = 0.002;
const MIN_AUDIBLE_OUTPUT_PEAK = 0.03;
const TARGET_AUDIBLE_OUTPUT_PEAK = 0.2;
const MAX_AUDIBLE_BOOST_GAIN = 20;

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function audioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channelCount * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = audioBuffer.length * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channelData = Array.from({ length: channelCount }, (_, channelIndex) =>
    audioBuffer.getChannelData(channelIndex),
  );

  let writeOffset = 44;

  for (let frameIndex = 0; frameIndex < audioBuffer.length; frameIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = channelData[channelIndex][frameIndex] ?? 0;
      const clampedSample = Math.max(-1, Math.min(1, sample));
      const pcmValue =
        clampedSample < 0
          ? Math.round(clampedSample * 0x8000)
          : Math.round(clampedSample * 0x7fff);

      view.setInt16(writeOffset, pcmValue, true);
      writeOffset += 2;
    }
  }

  return new Blob([wavBuffer], { type: "audio/wav" });
}

function createImpulseResponse(
  context: OfflineAudioContext,
  durationSeconds: number,
  decay: number,
) {
  const impulseLength = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
  const impulseBuffer = context.createBuffer(1, impulseLength, context.sampleRate);

  for (let channelIndex = 0; channelIndex < impulseBuffer.numberOfChannels; channelIndex += 1) {
    const channelData = impulseBuffer.getChannelData(channelIndex);

    for (let sampleIndex = 0; sampleIndex < impulseLength; sampleIndex += 1) {
      const progress = sampleIndex / impulseLength;
      const decayPower = Math.pow(1 - progress, decay);
      channelData[sampleIndex] = (Math.random() * 2 - 1) * decayPower;
    }
  }

  return impulseBuffer;
}

function createSoftClipCurve(amount: number) {
  const curveLength = 2048;
  const curve = new Float32Array(curveLength);
  const k = Math.max(1, amount);

  for (let index = 0; index < curveLength; index += 1) {
    const x = (index * 2) / (curveLength - 1) - 1;
    curve[index] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }

  return curve;
}

function createFurinEffectChain(
  context: OfflineAudioContext,
  inputNode: AudioNode,
) {
  const highPassFilter = context.createBiquadFilter();
  highPassFilter.type = "highpass";
  highPassFilter.frequency.value = 420;
  highPassFilter.Q.value = 0.6;

  const highShelfFilter = context.createBiquadFilter();
  highShelfFilter.type = "highshelf";
  highShelfFilter.frequency.value = 2600;
  highShelfFilter.gain.value = 4.2;

  const dryGain = context.createGain();
  dryGain.gain.value = 0.92;

  const wetGain = context.createGain();
  wetGain.gain.value = 0.22;

  const delayNode = context.createDelay(1.0);
  delayNode.delayTime.value = 0.16;

  const feedbackGain = context.createGain();
  feedbackGain.gain.value = 0.25;

  const convolverNode = context.createConvolver();
  convolverNode.buffer = createImpulseResponse(context, 0.36, 2.8);

  const mixNode = context.createGain();

  inputNode.connect(dryGain);
  dryGain.connect(mixNode);

  inputNode.connect(highPassFilter);
  highPassFilter.connect(highShelfFilter);

  highShelfFilter.connect(delayNode);
  delayNode.connect(feedbackGain);
  feedbackGain.connect(delayNode);
  delayNode.connect(convolverNode);
  convolverNode.connect(wetGain);
  wetGain.connect(mixNode);

  return mixNode;
}

function createShishiOdoshiEffectChain(
  context: OfflineAudioContext,
  inputNode: AudioNode,
) {
  const lowPassFilter = context.createBiquadFilter();
  lowPassFilter.type = "lowpass";
  lowPassFilter.frequency.value = 2200;
  lowPassFilter.Q.value = 1.1;

  const bodyPeakingFilter = context.createBiquadFilter();
  bodyPeakingFilter.type = "peaking";
  bodyPeakingFilter.frequency.value = 220;
  bodyPeakingFilter.Q.value = 0.95;
  bodyPeakingFilter.gain.value = 3.2;

  const shaperNode = context.createWaveShaper();
  shaperNode.curve = createSoftClipCurve(70);
  shaperNode.oversample = "2x";

  const dryGain = context.createGain();
  dryGain.gain.value = 0.94;

  const wetGain = context.createGain();
  wetGain.gain.value = 0.16;

  const delayNode = context.createDelay(1.0);
  delayNode.delayTime.value = 0.2;

  const feedbackGain = context.createGain();
  feedbackGain.gain.value = 0.2;

  const mixNode = context.createGain();

  inputNode.connect(dryGain);
  dryGain.connect(mixNode);

  inputNode.connect(lowPassFilter);
  lowPassFilter.connect(bodyPeakingFilter);
  bodyPeakingFilter.connect(shaperNode);

  shaperNode.connect(delayNode);
  delayNode.connect(feedbackGain);
  feedbackGain.connect(delayNode);
  delayNode.connect(wetGain);
  wetGain.connect(mixNode);

  return mixNode;
}

async function decodeAudioBuffer(sourceBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const browserWindow = window as WindowWithWebkitAudio;
  const AudioContextCtor = window.AudioContext ?? browserWindow.webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error("AudioContext is not available");
  }

  const decodeContext = new AudioContextCtor() as BrowserAudioContext;

  try {
    return await decodeContext.decodeAudioData(sourceBuffer);
  } finally {
    await decodeContext.close();
  }
}

function createOfflineContext(
  channelCount: number,
  frameCount: number,
  sampleRate: number,
) {
  const browserWindow = window as WindowWithWebkitAudio;
  const OfflineAudioContextCtor =
    window.OfflineAudioContext ?? browserWindow.webkitOfflineAudioContext;

  if (!OfflineAudioContextCtor) {
    throw new Error("OfflineAudioContext is not available");
  }

  return new OfflineAudioContextCtor(channelCount, frameCount, sampleRate);
}

async function renderGainAdjustedAudioBuffer(
  sourceBuffer: AudioBuffer,
  gainValue: number,
) {
  const offlineContext = createOfflineContext(
    sourceBuffer.numberOfChannels,
    sourceBuffer.length,
    sourceBuffer.sampleRate,
  );
  const sourceNode = offlineContext.createBufferSource();
  sourceNode.buffer = sourceBuffer;

  const gainNode = offlineContext.createGain();
  gainNode.gain.value = gainValue;

  sourceNode.connect(gainNode);
  gainNode.connect(offlineContext.destination);

  sourceNode.start(0);
  return offlineContext.startRendering();
}

async function normalizeRenderedAudioBuffer(audioBuffer: AudioBuffer) {
  const peak = getAudioBufferPeak(audioBuffer);

  if (peak < MIN_EFFECT_OUTPUT_PEAK) {
    return null;
  }

  if (peak >= MIN_AUDIBLE_OUTPUT_PEAK) {
    return audioBuffer;
  }

  const gainValue = Math.min(
    MAX_AUDIBLE_BOOST_GAIN,
    TARGET_AUDIBLE_OUTPUT_PEAK / Math.max(peak, MIN_EFFECT_OUTPUT_PEAK),
  );

  return renderGainAdjustedAudioBuffer(audioBuffer, gainValue);
}

export async function applyVoiceZooObjectEffect(
  sourceBlob: Blob,
  objectType: ObjectType,
): Promise<Blob> {
  if (typeof window === "undefined" || sourceBlob.size === 0) {
    return sourceBlob;
  }

  try {
    const sourceBuffer = await sourceBlob.arrayBuffer();
    const decodedBuffer = await decodeAudioBuffer(sourceBuffer);
    const tailSeconds = objectType === "furin" ? 0.62 : 0.48;
    const renderFrameCount =
      decodedBuffer.length + Math.ceil(decodedBuffer.sampleRate * tailSeconds);
    const offlineContext = createOfflineContext(
      decodedBuffer.numberOfChannels,
      renderFrameCount,
      decodedBuffer.sampleRate,
    );

    const sourceNode = offlineContext.createBufferSource();
    sourceNode.buffer = decodedBuffer;

    const inputGain = offlineContext.createGain();
    inputGain.gain.value = 1;

    const effectOutputNode =
      objectType === "furin"
        ? createFurinEffectChain(offlineContext, inputGain)
        : createShishiOdoshiEffectChain(offlineContext, inputGain);

    const compressorNode = offlineContext.createDynamicsCompressor();
    compressorNode.threshold.value = -20;
    compressorNode.knee.value = 20;
    compressorNode.ratio.value = 3;
    compressorNode.attack.value = 0.003;
    compressorNode.release.value = 0.2;

    const masterGain = offlineContext.createGain();
    masterGain.gain.value = 0.9;

    sourceNode.connect(inputGain);
    effectOutputNode.connect(compressorNode);
    compressorNode.connect(masterGain);
    masterGain.connect(offlineContext.destination);

    sourceNode.start(0);
    const renderedBuffer = await offlineContext.startRendering();

    const normalizedBuffer = await normalizeRenderedAudioBuffer(renderedBuffer);

    if (!normalizedBuffer) {
      return sourceBlob;
    }

    return audioBufferToWavBlob(normalizedBuffer);
  } catch {
    // If processing fails (unsupported environment, decode issue), keep the raw recording.
    return sourceBlob;
  }
}

export async function ensureVoiceZooAudibleBlob(sourceBlob: Blob): Promise<Blob> {
  if (typeof window === "undefined" || sourceBlob.size === 0) {
    return sourceBlob;
  }

  try {
    const sourceBuffer = await sourceBlob.arrayBuffer();
    const decodedBuffer = await decodeAudioBuffer(sourceBuffer);
    const normalizedBuffer = await normalizeRenderedAudioBuffer(decodedBuffer);

    if (!normalizedBuffer || normalizedBuffer === decodedBuffer) {
      return sourceBlob;
    }

    return audioBufferToWavBlob(normalizedBuffer);
  } catch {
    return sourceBlob;
  }
}

function getAudioBufferPeak(audioBuffer: AudioBuffer) {
  let peak = 0;

  for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
    const channelData = audioBuffer.getChannelData(channelIndex);

    for (let sampleIndex = 0; sampleIndex < channelData.length; sampleIndex += 1) {
      const magnitude = Math.abs(channelData[sampleIndex] ?? 0);

      if (magnitude > peak) {
        peak = magnitude;
      }
    }
  }

  return peak;
}