import { Audio } from 'expo-av';

let configured = false;

export async function configureVoiceAudioSession(): Promise<void> {
  if (configured) return;
  configured = true;

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    configured = false;
  }
}

export function resetAudioSessionConfig(): void {
  configured = false;
}
