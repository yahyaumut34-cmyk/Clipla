from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime
from enum import Enum

class JobStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class EditAction(BaseModel):
    """Single edit action with deterministic structure and validation"""
    action: Literal["cut", "speed", "audio"]
    start_time: float = Field(..., ge=0, description="Start time in seconds")
    end_time: float = Field(..., ge=0, description="End time in seconds")
    parameters: Dict[str, Any] = Field(..., description="Action-specific parameters")
    reason: str = Field(..., min_length=5, max_length=200, description="Brief explanation")
    
    @model_validator(mode='after')
    def validate_times(self):
        """Validate time ordering and parameters"""
        if self.end_time <= self.start_time:
            raise ValueError(f"end_time ({self.end_time}) must be > start_time ({self.start_time})")
        
        # Validate parameters based on action type
        if self.action == "cut":
            if "remove" not in self.parameters:
                raise ValueError("cut action requires 'remove' parameter")
        elif self.action == "speed":
            if "factor" not in self.parameters:
                raise ValueError("speed action requires 'factor' parameter")
            factor = self.parameters["factor"]
            if not isinstance(factor, (int, float)) or factor <= 0 or factor > 3:
                raise ValueError(f"speed factor must be 0 < factor <= 3, got {factor}")
        elif self.action == "audio":
            if "normalize" not in self.parameters and "volume" not in self.parameters:
                raise ValueError("audio action requires 'normalize' or 'volume' parameter")
        
        return self

class EditPlan(BaseModel):
    """Deterministic edit plan output with validation"""
    edits: List[EditAction] = Field(..., description="List of edit actions")
    estimated_duration: float = Field(..., ge=0, description="Estimated video duration after edits")
    optimization_summary: str = Field(..., min_length=10, max_length=500)
    quality_score: int = Field(..., ge=70, le=100, description="Quality score 70-100")
    validation_notes: List[str] = Field(default_factory=list, description="Validation warnings/notes")
    
    @model_validator(mode='after')
    def validate_edit_plan(self):
        """Validate edit plan consistency"""
        if not self.edits:
            self.validation_notes.append("Warning: Empty edit plan")
        
        # Check for timeline overlaps
        cut_segments = [(e.start_time, e.end_time) for e in self.edits if e.action == "cut"]
        for i, (s1, e1) in enumerate(cut_segments):
            for s2, e2 in cut_segments[i+1:]:
                if not (e1 <= s2 or e2 <= s1):  # Check overlap
                    raise ValueError(f"Timeline overlap detected: ({s1}-{e1}) and ({s2}-{e2})")
        
        return self

class UserIntent(BaseModel):
    """Parsed user command intent with validation"""
    intent: str = Field(..., min_length=10, max_length=200)
    target_style: Literal["fast-paced", "balanced", "cinematic", "energetic"]
    cut_preference: Literal["aggressive", "moderate", "conservative"]
    focus_areas: List[str] = Field(..., min_items=1, max_items=10)
    preserve_elements: List[str] = Field(..., max_items=10)
    pacing_adjustment: Literal["speed-up", "maintain", "slow-down"]
    audio_normalization: bool
    
    @field_validator('focus_areas', 'preserve_elements')
    @classmethod
    def validate_string_lists(cls, v):
        """Validate list items are non-empty strings"""
        if not all(isinstance(item, str) and len(item) > 0 for item in v):
            raise ValueError("All list items must be non-empty strings")
        return v

class VideoAnalysis(BaseModel):
    """Video analysis results with validation"""
    duration: float = Field(..., gt=0, description="Video duration in seconds")
    sample_rate: int = Field(..., gt=0, description="Audio sample rate")
    segments: List[Dict[str, Any]] = Field(..., min_items=1)
    statistics: Dict[str, Any]
    
    @field_validator('duration')
    @classmethod
    def validate_duration(cls, v):
        """Validate duration is reasonable"""
        if v > 7200:  # 2 hours max
            raise ValueError(f"Video duration too long: {v}s (max 7200s)")
        return v

class ProcessResult(BaseModel):
    """Complete processing result"""
    status: str
    user_intent: UserIntent
    video_analysis: Dict[str, Any]
    edit_plan: EditPlan
    metadata: Dict[str, Any]

class Job(BaseModel):
    """Job database model"""
    job_id: str
    filename: str
    video_path: str
    status: JobStatus
    command_text: Optional[str] = None
    result: Optional[ProcessResult] = None
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

# API Request/Response Models
class UploadResponse(BaseModel):
    job_id: str
    filename: str
    status: str
    message: str

class TranscribeResponse(BaseModel):
    text: str

class ProcessRequest(BaseModel):
    command_text: str

class JobResponse(BaseModel):
    job_id: str
    status: str
    filename: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    result: Optional[ProcessResult] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    service: str
    agents: List[str]

# Timeline Compiler Models
class FFmpegCommand(BaseModel):
    """Single ffmpeg command with metadata"""
    command_type: Literal["cut", "speed", "audio", "merge"]
    command: str = Field(..., min_length=10, description="Full ffmpeg command string")
    edit_index: Optional[int] = Field(None, description="Index of source edit action")
    input_file: str = Field(..., description="Input file path/pattern")
    output_file: str = Field(..., description="Output file path")
    description: str = Field(..., min_length=5, max_length=200)

class CompileResult(BaseModel):
    """Timeline compiler output - ffmpeg commands only (no execution)"""
    status: str = "compiled"
    input_edit_plan: EditPlan
    generated_ffmpeg_commands: List[FFmpegCommand]
    total_commands: int
    estimated_steps: int
    warnings: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

# Voice DSL Models
class DSLAction(BaseModel):
    """Single DSL action with normalized parameters"""
    type: Literal["cut", "speed", "audio", "trim", "keep"]
    target: Literal["silence", "low-energy", "high-energy", "segment", "all"]
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Normalized parameters")
    confidence: float = Field(default=1.0, ge=0, le=1, description="Action confidence 0-1")

class VoiceDSL(BaseModel):
    """Domain-specific language output for voice/text commands"""
    version: str = "1.0"
    confidence: float = Field(..., ge=0, le=1, description="Overall parsing confidence")
    actions: List[DSLAction] = Field(..., min_items=0, description="Normalized edit actions")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Parsing metadata")
    
    @field_validator('confidence')
    @classmethod
    def validate_confidence(cls, v):
        """Ensure confidence is reasonable"""
        if v < 0.3:
            raise ValueError(f"Confidence too low: {v} (min 0.3)")
        return v


