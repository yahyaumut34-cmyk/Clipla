from services.video import video_processor
from services.audio import audio_analyzer
from schemas import VideoAnalysis
import os
import logging

logger = logging.getLogger(__name__)

class AnalysisAgent:
    """Perform audio/video analysis for editing decisions (production-grade)"""
    
    async def analyze_video(self, video_path: str) -> VideoAnalysis:
        """Analyze video for silence, energy, speech segments with validation"""
        if not video_path or not os.path.exists(video_path):
            raise ValueError(f"Video file not found: {video_path}")
        
        logger.info(f"AnalysisAgent: Starting analysis for {os.path.basename(video_path)}")
        
        audio_path = None
        try:
            # Extract audio from video
            audio_path, duration = await video_processor.extract_audio(video_path)
            
            if duration <= 0:
                raise ValueError(f"Invalid video duration: {duration}")
            
            if duration > 7200:  # 2 hours max
                raise ValueError(f"Video too long: {duration}s (max 7200s)")
            
            logger.info(f"AnalysisAgent: Video duration={duration}s, analyzing audio...")
            
            # Analyze audio
            analysis = await audio_analyzer.analyze_audio(audio_path, duration)
            
            # Validate analysis results
            if not analysis.get('segments'):
                raise ValueError("Analysis produced no segments")
            
            if analysis['duration'] != duration:
                logger.warning(f"Duration mismatch: video={duration}, analysis={analysis['duration']}")
            
            result = VideoAnalysis(
                duration=analysis['duration'],
                sample_rate=analysis['sample_rate'],
                segments=analysis['segments'],
                statistics=analysis['statistics']
            )
            
            logger.info(f"AnalysisAgent: Analysis complete ({len(result.segments)} segments)")
            return result
            
        except Exception as e:
            logger.error(f"AnalysisAgent: Analysis failed: {e}")
            raise
        finally:
            # Cleanup temp audio file
            if audio_path:
                video_processor.cleanup_temp_files(audio_path)

analysis_agent = AnalysisAgent()
