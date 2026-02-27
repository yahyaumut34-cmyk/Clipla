from schemas import VoiceDSL, DSLAction
from typing import Dict, List, Tuple, Optional
import re
import logging

logger = logging.getLogger(__name__)

class VoiceDSLParser:
    """
    Parse natural language or STT output into internal DSL format.
    Converts voice commands to structured, normalized edit actions.
    """
    
    # Keyword patterns for action detection
    CUT_KEYWORDS = [
        "cut", "remove", "delete", "trim", "eliminate", "drop", "skip"
    ]
    SPEED_KEYWORDS = [
        "speed", "fast", "faster", "quick", "accelerate", "pace", "tempo"
    ]
    AUDIO_KEYWORDS = [
        "audio", "sound", "volume", "normalize", "loud", "quiet", "mute"
    ]
    KEEP_KEYWORDS = [
        "keep", "preserve", "save", "maintain", "retain"
    ]
    
    # Target patterns
    SILENCE_TARGETS = [
        "silence", "silent", "quiet", "pause", "gap", "dead air"
    ]
    LOW_ENERGY_TARGETS = [
        "boring", "slow", "dull", "low-energy", "unenergetic"
    ]
    HIGH_ENERGY_TARGETS = [
        "energetic", "exciting", "high-energy", "active", "intense"
    ]
    
    def __init__(self):
        self.min_confidence = 0.3
        
    async def parse(
        self, 
        text: str, 
        timestamps: Optional[List[Dict]] = None
    ) -> VoiceDSL:
        """
        Parse voice/text input into DSL format.
        
        Args:
            text: Raw text from STT or user input
            timestamps: Optional list of {word, start, end} for precise timing
            
        Returns:
            VoiceDSL with normalized actions
        """
        if not text or len(text.strip()) < 3:
            raise ValueError("Text too short for parsing")
        
        logger.info(f"VoiceDSL: Parsing text (length={len(text)})")
        
        # Normalize text
        normalized_text = self._normalize_text(text)
        
        # Extract actions
        actions, keywords_found = self._extract_actions(normalized_text)
        
        # Calculate confidence based on keyword matches
        confidence = self._calculate_confidence(text, keywords_found)
        
        # Add default action if no actions detected
        if not actions:
            logger.warning("VoiceDSL: No actions detected, adding safe default")
            actions.append(DSLAction(
                type="cut",
                target="silence",
                parameters={"threshold_seconds": 1.0},
                confidence=0.5
            ))
            confidence = max(0.3, confidence * 0.5)
        
        dsl = VoiceDSL(
            version="1.0",
            confidence=confidence,
            actions=actions,
            metadata={
                "original_text": text,
                "normalized_text": normalized_text,
                "detected_keywords": keywords_found,
                "has_timestamps": timestamps is not None,
                "action_count": len(actions)
            }
        )
        
        logger.info(f"VoiceDSL: Parsed {len(actions)} actions (confidence={confidence:.2f})")
        return dsl
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for parsing"""
        # Lowercase
        normalized = text.lower().strip()
        
        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Remove punctuation except periods (for sentence boundaries)
        normalized = re.sub(r'[^\w\s\.]', '', normalized)
        
        return normalized
    
    def _extract_actions(self, text: str) -> Tuple[List[DSLAction], List[str]]:
        """Extract DSL actions from normalized text"""
        actions = []
        keywords_found = []
        
        # Check for cut actions
        cut_action, cut_keywords = self._extract_cut_action(text)
        if cut_action:
            actions.append(cut_action)
            keywords_found.extend(cut_keywords)
        
        # Check for speed actions
        speed_action, speed_keywords = self._extract_speed_action(text)
        if speed_action:
            actions.append(speed_action)
            keywords_found.extend(speed_keywords)
        
        # Check for audio actions
        audio_action, audio_keywords = self._extract_audio_action(text)
        if audio_action:
            actions.append(audio_action)
            keywords_found.extend(audio_keywords)
        
        # Check for keep actions (preservation)
        keep_action, keep_keywords = self._extract_keep_action(text)
        if keep_action:
            actions.append(keep_action)
            keywords_found.extend(keep_keywords)
        
        return actions, keywords_found
    
    def _extract_cut_action(self, text: str) -> Tuple[Optional[DSLAction], List[str]]:
        """Extract cut/remove actions"""
        keywords_found = []
        
        # Check for cut keywords
        has_cut = any(keyword in text for keyword in self.CUT_KEYWORDS)
        if not has_cut:
            return None, keywords_found
        
        keywords_found.extend([k for k in self.CUT_KEYWORDS if k in text])
        
        # Determine target
        target = "all"
        parameters = {}
        
        if any(t in text for t in self.SILENCE_TARGETS):
            target = "silence"
            keywords_found.extend([t for t in self.SILENCE_TARGETS if t in text])
            # Extract threshold if mentioned
            threshold = self._extract_number(text, context="second")
            parameters["threshold_seconds"] = threshold if threshold else 1.0
        
        elif any(t in text for t in self.LOW_ENERGY_TARGETS):
            target = "low-energy"
            keywords_found.extend([t for t in self.LOW_ENERGY_TARGETS if t in text])
        
        # Confidence based on specificity
        confidence = 0.9 if target != "all" else 0.6
        
        action = DSLAction(
            type="cut",
            target=target,
            parameters=parameters,
            confidence=confidence
        )
        
        return action, keywords_found
    
    def _extract_speed_action(self, text: str) -> Tuple[Optional[DSLAction], List[str]]:
        """Extract speed change actions"""
        keywords_found = []
        
        # Check for speed keywords
        has_speed = any(keyword in text for keyword in self.SPEED_KEYWORDS)
        if not has_speed:
            return None, keywords_found
        
        keywords_found.extend([k for k in self.SPEED_KEYWORDS if k in text])
        
        # Determine target
        target = "all"
        parameters = {"adaptive": True}
        
        if any(t in text for t in self.LOW_ENERGY_TARGETS):
            target = "low-energy"
            keywords_found.extend([t for t in self.LOW_ENERGY_TARGETS if t in text])
        
        # Extract speed factor
        factor = self._extract_speed_factor(text)
        parameters["factor"] = factor
        
        # Check for specific time ranges
        time_range = self._extract_time_range(text)
        if time_range:
            parameters.update(time_range)
        
        confidence = 0.85 if factor != 1.5 else 0.75  # Higher confidence if specific factor
        
        action = DSLAction(
            type="speed",
            target=target,
            parameters=parameters,
            confidence=confidence
        )
        
        return action, keywords_found
    
    def _extract_audio_action(self, text: str) -> Tuple[Optional[DSLAction], List[str]]:
        """Extract audio adjustment actions"""
        keywords_found = []
        
        # Check for audio keywords
        has_audio = any(keyword in text for keyword in self.AUDIO_KEYWORDS)
        if not has_audio:
            return None, keywords_found
        
        keywords_found.extend([k for k in self.AUDIO_KEYWORDS if k in text])
        
        parameters = {}
        target = "all"
        
        # Check for normalization
        if "normalize" in text or "consistent" in text or "level" in text:
            parameters["normalize"] = True
            keywords_found.append("normalize")
        
        # Check for volume adjustment
        if "volume" in text or "loud" in text or "quiet" in text:
            volume = self._extract_volume(text)
            if volume is not None:
                parameters["volume"] = volume
        
        # Check for mute
        if "mute" in text or "silent" in text:
            parameters["mute"] = True
            keywords_found.append("mute")
        
        if not parameters:
            # Default to normalization if no specific params
            parameters["normalize"] = True
        
        confidence = 0.8
        
        action = DSLAction(
            type="audio",
            target=target,
            parameters=parameters,
            confidence=confidence
        )
        
        return action, keywords_found
    
    def _extract_keep_action(self, text: str) -> Tuple[Optional[DSLAction], List[str]]:
        """Extract preservation/keep actions"""
        keywords_found = []
        
        # Check for keep keywords
        has_keep = any(keyword in text for keyword in self.KEEP_KEYWORDS)
        if not has_keep:
            return None, keywords_found
        
        keywords_found.extend([k for k in self.KEEP_KEYWORDS if k in text])
        
        # Determine what to keep
        target = "high-energy"
        parameters = {}
        
        if any(t in text for t in self.HIGH_ENERGY_TARGETS):
            target = "high-energy"
            keywords_found.extend([t for t in self.HIGH_ENERGY_TARGETS if t in text])
        
        if "intro" in text or "beginning" in text:
            parameters["preserve_intro"] = True
        
        if "outro" in text or "end" in text or "conclusion" in text:
            parameters["preserve_outro"] = True
        
        confidence = 0.7
        
        action = DSLAction(
            type="keep",
            target=target,
            parameters=parameters,
            confidence=confidence
        )
        
        return action, keywords_found
    
    def _extract_number(self, text: str, context: str = "") -> Optional[float]:
        """Extract numeric value from text"""
        # Look for patterns like "2 seconds", "1.5x", "150%"
        patterns = [
            r'(\d+\.?\d*)\s*' + context,
            r'(\d+\.?\d*)\s*x',
            r'(\d+\.?\d*)\s*%',
            r'(\d+\.?\d*)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    value = float(match.group(1))
                    # Adjust for percentage
                    if '%' in text[match.start():match.end() + 1]:
                        value = value / 100.0
                    return value
                except ValueError:
                    continue
        
        return None
    
    def _extract_speed_factor(self, text: str) -> float:
        """Extract speed factor from text"""
        # Look for explicit factors
        factor = self._extract_number(text, context="x")
        
        if factor and 0.5 <= factor <= 3.0:
            return factor
        
        # Check for descriptive speeds
        if "very fast" in text or "much faster" in text:
            return 2.0
        elif "fast" in text or "faster" in text or "quick" in text:
            return 1.5
        elif "slightly fast" in text or "bit faster" in text:
            return 1.2
        
        # Default moderate speed increase
        return 1.5
    
    def _extract_volume(self, text: str) -> Optional[float]:
        """Extract volume level from text"""
        volume = self._extract_number(text, context="")
        
        if volume is not None:
            # Normalize to 0-2 range
            if volume > 2:
                volume = volume / 100.0  # Assume percentage
            return max(0.0, min(2.0, volume))
        
        # Check descriptive volumes
        if "louder" in text or "increase" in text:
            return 1.2
        elif "quieter" in text or "decrease" in text or "lower" in text:
            return 0.8
        
        return None
    
    def _extract_time_range(self, text: str) -> Optional[Dict[str, float]]:
        """Extract time range if specified"""
        # Look for patterns like "from 10 to 20 seconds"
        pattern = r'from\s+(\d+\.?\d*)\s+to\s+(\d+\.?\d*)'
        match = re.search(pattern, text)
        
        if match:
            start = float(match.group(1))
            end = float(match.group(2))
            return {"start_time": start, "end_time": end}
        
        return None
    
    def _calculate_confidence(self, text: str, keywords_found: List[str]) -> float:
        """Calculate overall parsing confidence"""
        if not keywords_found:
            return 0.3
        
        # Base confidence from keyword count
        base_confidence = min(0.9, 0.5 + (len(keywords_found) * 0.1))
        
        # Boost for specific numbers/parameters
        has_numbers = bool(re.search(r'\d+\.?\d*', text))
        if has_numbers:
            base_confidence = min(1.0, base_confidence + 0.1)
        
        # Reduce for very short text
        if len(text) < 20:
            base_confidence *= 0.8
        
        return max(self.min_confidence, round(base_confidence, 2))
    
    def dsl_to_user_intent(self, dsl: VoiceDSL) -> Dict[str, any]:
        """
        Convert DSL to UserIntent-compatible format.
        Helper for integration with existing CommandAgent flow.
        """
        # Determine style from actions
        has_speed = any(a.type == "speed" for a in dsl.actions)
        has_aggressive_cuts = any(
            a.type == "cut" and a.parameters.get("threshold_seconds", 1.0) < 1.0 
            for a in dsl.actions
        )
        
        target_style = "energetic" if has_speed else "balanced"
        cut_preference = "aggressive" if has_aggressive_cuts else "moderate"
        
        # Extract focus areas
        focus_areas = []
        for action in dsl.actions:
            if action.type == "cut" and action.target == "silence":
                focus_areas.append("silence")
            elif action.type == "cut" and action.target == "low-energy":
                focus_areas.append("low-energy")
        
        if not focus_areas:
            focus_areas = ["silence"]
        
        # Audio normalization
        audio_norm = any(
            a.type == "audio" and a.parameters.get("normalize", False) 
            for a in dsl.actions
        )
        
        return {
            "intent": dsl.metadata.get("normalized_text", "Edit video"),
            "target_style": target_style,
            "cut_preference": cut_preference,
            "focus_areas": list(set(focus_areas)),
            "preserve_elements": ["key-points"],
            "pacing_adjustment": "speed-up" if has_speed else "maintain",
            "audio_normalization": audio_norm
        }

voice_dsl_parser = VoiceDSLParser()
