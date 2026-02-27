import json
import asyncio
from typing import Dict, Optional
from pathlib import Path
from datetime import datetime
from schemas import Job, JobStatus
from config import config

class JobStorage:
    """Simple in-memory storage with optional JSON persistence"""
    
    def __init__(self):
        self._jobs: Dict[str, Dict] = {}
        self._lock = asyncio.Lock()
        self._load_from_file()
    
    def _load_from_file(self):
        """Load jobs from JSON file if exists"""
        if config.STORAGE_FILE.exists():
            try:
                with open(config.STORAGE_FILE, 'r') as f:
                    data = json.load(f)
                    self._jobs = data
            except Exception:
                pass
    
    async def _save_to_file(self):
        """Persist jobs to JSON file"""
        try:
            with open(config.STORAGE_FILE, 'w') as f:
                json.dump(self._jobs, f, default=str)
        except Exception:
            pass
    
    async def create_job(self, job: Job) -> Job:
        """Create new job"""
        async with self._lock:
            self._jobs[job.job_id] = job.model_dump(mode='json')
            await self._save_to_file()
        return job
    
    async def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID"""
        job_data = self._jobs.get(job_id)
        if job_data:
            return Job(**job_data)
        return None
    
    async def update_job(self, job_id: str, updates: Dict) -> Optional[Job]:
        """Update job fields"""
        async with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id].update(updates)
                await self._save_to_file()
                return Job(**self._jobs[job_id])
        return None
    
    async def list_jobs(self, limit: int = 100) -> list:
        """List recent jobs"""
        jobs = list(self._jobs.values())
        jobs.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return [Job(**j) for j in jobs[:limit]]

job_storage = JobStorage()
