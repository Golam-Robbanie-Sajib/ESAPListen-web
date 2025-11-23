# transcription_service.py - Enhanced with Pedalboard DRC

import os
import logging
os.environ['HF_HUB_DISABLE_SYMLINKS'] = '1'

import asyncio
import numpy as np
import assemblyai as aai
import soundfile as sf
from dataclasses import dataclass
from typing import List
from dotenv import load_dotenv

# --- Pedalboard for DRC ---
try:
    from pedalboard import Pedalboard, Compressor, Gain, Limiter
    PEDALBOARD_AVAILABLE = True
except ImportError:
    PEDALBOARD_AVAILABLE = False

load_dotenv()
logger = logging.getLogger(__name__)

@dataclass
class TranscriptSegment:
    speaker: str
    text: str
    start_time: float
    end_time: float

    def to_text(self) -> str:
        start = self.format_time(self.start_time)
        end = self.format_time(self.end_time)
        return f'[{start} - {end}] {self.speaker}: {self.text}'

    @staticmethod
    def format_time(seconds: float) -> str:
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f'{mins:02d}:{secs:02d}'


class AudioEnhancer:
    """Audio enhancement with Pedalboard DRC (Dynamic Range Compression)"""

    def __init__(self, target_sr: int = 16000):
        self.target_sr = target_sr
        logger.info('🎧 Audio Enhancer initialized')
        if not PEDALBOARD_AVAILABLE:
            logger.warning("⚠️ 'pedalboard' library not found. DRC will be skipped.")

    def apply_drc(self, audio: np.ndarray, sample_rate: int) -> np.ndarray:
        """
        Dynamic Range Compression (DRC) - No Gate
        Goal: Pure volume leveling. Fix distance drop without altering tone.
        Chain: Compressor -> Gain -> Limiter
        """
        if not PEDALBOARD_AVAILABLE:
            return audio

        board = Pedalboard([
            # Fast compressor to catch voice peaks
            Compressor(
                threshold_db=-25,
                ratio=4,
                attack_ms=2,
                release_ms=50
            ),

            # Make Up Gain to boost quiet parts
            Gain(gain_db=15),

            # Safety ceiling
            Limiter(threshold_db=-1.0)
        ])

        return board(audio, sample_rate)

    def enhance_file(self, input_path: str, output_path: str) -> bool:
        """
        Loads audio from file, applies DRC, and saves to output_path.
        Returns True if successful, False otherwise.
        """
        try:
            if not os.path.exists(input_path):
                logger.error(f"Input file not found: {input_path}")
                return False

            # Load audio file
            audio, original_sr = sf.read(input_path)

            # Convert stereo to mono if needed
            if audio.ndim > 1:
                audio = np.mean(audio, axis=1)

            # Resample if needed
            if original_sr != self.target_sr:
                try:
                    import torchaudio
                    import torch
                    audio_tensor = torch.from_numpy(audio).float().unsqueeze(0)
                    resampler = torchaudio.transforms.Resample(original_sr, self.target_sr)
                    audio_tensor = resampler(audio_tensor)
                    audio = audio_tensor.squeeze().numpy()
                except ImportError:
                    logger.warning(f"⚠️ torchaudio not available, keeping sample rate at {original_sr}")
                    self.target_sr = original_sr

            # Ensure correct shape for Pedalboard (channels, samples)
            if audio.ndim == 1:
                audio = audio[np.newaxis, :]

            # Apply DRC
            enhanced = self.apply_drc(audio, self.target_sr)

            # Save enhanced audio
            if enhanced.shape[0] == 1:
                audio_to_save = enhanced.squeeze()
            else:
                audio_to_save = enhanced.T

            sf.write(output_path, audio_to_save, self.target_sr)
            logger.info(f"   ✓ Enhanced audio saved: {output_path}")
            return True

        except Exception as e:
            logger.error(f"   ❌ enhance_file failed: {e}", exc_info=True)
            return False


class AssemblyAITranscriber:
    """AssemblyAI transcriber with automatic diarization"""

    def __init__(self, api_key: str):
        aai.settings.api_key = api_key
        self.transcriber = aai.Transcriber()
        logger.info('🤖 AssemblyAI transcriber initialized')

    async def transcribe_file(self, file_path: str) -> List[TranscriptSegment]:
        """
        Transcribes a file directly from its path.
        AssemblyAI handles VAD and diarization automatically.
        """
        config = aai.TranscriptionConfig(
            speaker_labels=True,
            language_detection=True
        )

        logger.info(f"   📤 Transcribing file with AssemblyAI: {file_path}")

        # AssemblyAI handles upload, VAD, and diarization
        transcript = await asyncio.to_thread(
            self.transcriber.transcribe,
            data=file_path,
            config=config
        )

        if transcript.status == aai.TranscriptStatus.error:
            logger.error(f"   ❌ Transcription failed: {transcript.error}")
            return []

        if not hasattr(transcript, 'utterances') or not transcript.utterances:
            logger.warning("   ⚠️ No utterances found")
            full_text = transcript.text if hasattr(transcript, 'text') else "No transcription"
            return [TranscriptSegment("Speaker 1", full_text, 0.0, 0.0)]

        segments = [
            TranscriptSegment(
                speaker=f'Speaker {u.speaker}',
                text=u.text.strip(),
                start_time=u.start / 1000.0,
                end_time=u.end / 1000.0
            ) for u in transcript.utterances
        ]

        logger.info(f"   ✓ Transcribed {len(segments)} segments")
        return segments


class AssemblyAIPipeline:
    """Complete pipeline: Enhancement -> Transcription"""

    def __init__(self, api_key: str, sample_rate: int = 16000):
        self.transcriber = AssemblyAITranscriber(api_key=api_key)
        self.enhancer = AudioEnhancer(target_sr=sample_rate)
        logger.info("✅ AssemblyAI Pipeline initialized (with DRC enhancement)")

    async def transcribe_file(self, file_path: str) -> List[TranscriptSegment]:
        """Enhance file with DRC, then transcribe"""

        # Create temporary file for enhanced audio
        temp_enhanced_path = f"{file_path}_enhanced.wav"

        try:
            logger.info(f"   ✨ Applying DRC enhancement to: {file_path}")
            success = await asyncio.to_thread(
                self.enhancer.enhance_file,
                file_path,
                temp_enhanced_path
            )

            # Use enhanced file if successful, otherwise use original
            target_file = temp_enhanced_path if success else file_path
            if not success:
                logger.warning("   ⚠️ Enhancement failed, using original file")

            return await self.transcriber.transcribe_file(target_file)

        finally:
            # Cleanup temporary enhanced file
            if os.path.exists(temp_enhanced_path):
                try:
                    os.remove(temp_enhanced_path)
                except Exception as e:
                    logger.warning(f"   ⚠️ Failed to clean up {temp_enhanced_path}: {e}")


# --- Module Initialization ---
TRANSCRIPTION_PROVIDER = os.getenv("TRANSCRIPTION_PROVIDER", "assemblyai").lower()
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

transcriber = None

logger.info("="*70)
logger.info(f"🎤 Transcription Provider: '{TRANSCRIPTION_PROVIDER}'")
logger.info("="*70)

try:
    if TRANSCRIPTION_PROVIDER == "assemblyai":
        if ASSEMBLYAI_API_KEY:
            transcriber = AssemblyAIPipeline(api_key=ASSEMBLYAI_API_KEY)
        else:
            logger.error("❌ ASSEMBLYAI_API_KEY not set")
    elif TRANSCRIPTION_PROVIDER == "groq":
        if GROQ_API_KEY:
            logger.warning("⚠️ Groq provider selected but using simplified version")
            # Groq would need similar enhancement pipeline
            logger.error("❌ Groq provider not fully implemented in multi-user version")
        else:
            logger.error("❌ GROQ_API_KEY not set")
    else:
        logger.error(f"❌ Invalid provider: '{TRANSCRIPTION_PROVIDER}'")

except Exception as e:
    logger.error(f"❌ Transcriber initialization failed: {e}", exc_info=True)

if not transcriber:
    logger.error("="*70)
    logger.error("❌ No valid transcriber initialized")
    logger.error("="*70)
