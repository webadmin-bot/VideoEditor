import time
import uuid
import threading
from typing import Dict, Any, Optional, List, Callable

JOB_STATES = [
    "QUEUED",
    "VALIDATING",
    "ANALYZING",
    "TRANSCRIBING",
    "ALIGNING",
    "GENERATING_SUBTITLES",
    "ENHANCING",
    "RENDERING",
    "VALIDATING_OUTPUT",
    "COMPLETED",
    "FAILED",
    "CANCELLED"
]

class Job:
    def __init__(self, job_type: str, payload: Dict[str, Any]):
        self.id = str(uuid.uuid4())
        self.job_type = job_type
        self.payload = payload
        self.stage = "QUEUED"
        self.progress_percent = 0.0
        self.start_time = time.time()
        self.end_time: Optional[float] = None
        self.elapsed_seconds = 0.0
        self.estimated_remaining_seconds: Optional[float] = None
        self.message = "Job queued in local processing pool"
        self.result: Optional[Dict[str, Any]] = None
        self.error: Optional[str] = None
        self.cancelled = False
        self.artifacts: Dict[str, str] = {}

    def update(self, stage: str, progress: float, message: str = ""):
        self.stage = stage
        self.progress_percent = round(progress, 1)
        self.elapsed_seconds = round(time.time() - self.start_time, 1)
        if message:
            self.message = message
        if progress > 5 and progress < 100:
            rate = progress / max(1.0, self.elapsed_seconds)
            remaining_pct = 100.0 - progress
            self.estimated_remaining_seconds = round(remaining_pct / max(0.01, rate), 1)

    def complete(self, result: Dict[str, Any], artifacts: Optional[Dict[str, str]] = None):
        self.stage = "COMPLETED"
        self.progress_percent = 100.0
        self.end_time = time.time()
        self.elapsed_seconds = round(self.end_time - self.start_time, 1)
        self.estimated_remaining_seconds = 0.0
        self.message = "Processing completed successfully"
        self.result = result
        if artifacts:
            self.artifacts = artifacts

    def fail(self, error_message: str):
        self.stage = "FAILED"
        self.end_time = time.time()
        self.elapsed_seconds = round(self.end_time - self.start_time, 1)
        self.estimated_remaining_seconds = 0.0
        self.error = error_message
        self.message = f"Error: {error_message}"

    def cancel(self):
        self.cancelled = True
        self.stage = "CANCELLED"
        self.end_time = time.time()
        self.elapsed_seconds = round(self.end_time - self.start_time, 1)
        self.estimated_remaining_seconds = 0.0
        self.message = "Job cancelled by user"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "job_type": self.job_type,
            "stage": self.stage,
            "progress_percent": self.progress_percent,
            "elapsed_seconds": round(time.time() - self.start_time, 1) if not self.end_time else self.elapsed_seconds,
            "estimated_remaining_seconds": self.estimated_remaining_seconds,
            "message": self.message,
            "error": self.error,
            "artifacts": self.artifacts,
            "result": self.result,
        }

class JobManager:
    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.Lock()
        self._listeners: List[Callable[[Dict[str, Any]], None]] = []

    def create_job(self, job_type: str, payload: Dict[str, Any]) -> Job:
        with self._lock:
            job = Job(job_type, payload)
            self._jobs[job.id] = job
            return job

    def get_job(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def cancel_job(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
            if job and job.stage not in ["COMPLETED", "FAILED", "CANCELLED"]:
                job.cancel()
                return True
            return False

    def list_jobs(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [j.to_dict() for j in reversed(list(self._jobs.values()))]

job_manager = JobManager()
