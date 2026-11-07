import time
import uuid
import subprocess
from typing import Dict, Any, Optional

class Job:
    def __init__(self, job_type: str, metadata: Optional[Dict[str, Any]] = None):
        self.id = f"job_{uuid.uuid4().hex[:8]}"
        self.job_type = job_type
        self.metadata = metadata or {}
        self.stage = "QUEUED"
        self.progress_percent = 0.0
        self.message = "Job initialized"
        self.start_time = time.time()
        self.end_time = None
        self.cancelled = False
        self.error = None
        self.result = None
        self.artifacts = {}
        self.process: Optional[subprocess.Popen] = None

    def set_process(self, proc: subprocess.Popen):
        self.process = proc

    def update(self, stage: str, progress: float, message: str = ""):
        self.stage = stage
        self.progress_percent = min(100.0, max(0.0, float(progress)))
        if message:
            self.message = message

    def complete(self, result: Any = None, artifacts: Optional[Dict[str, Any]] = None):
        self.stage = "COMPLETED"
        self.progress_percent = 100.0
        self.end_time = time.time()
        self.message = "Job finished successfully"
        self.result = result
        self.process = None
        if artifacts:
            self.artifacts.update(artifacts)

    def fail(self, error: str):
        self.stage = "FAILED"
        self.end_time = time.time()
        self.error = error
        self.message = f"Job failed: {error}"
        self.process = None

    def cancel(self):
        self.cancelled = True
        self.stage = "CANCELLED"
        self.end_time = time.time()
        self.message = "Job cancelled by user"
        if self.process:
            try:
                self.process.terminate()
                time.sleep(0.1)
                if self.process.poll() is None:
                    self.process.kill()
            except Exception:
                pass
            self.process = None

    def to_dict(self) -> Dict[str, Any]:
        elapsed = round(time.time() - self.start_time, 1)
        remaining = None
        if self.progress_percent > 5 and self.progress_percent < 99:
            total_est = (elapsed / (self.progress_percent / 100.0))
            remaining = max(1, round(total_est - elapsed))

        return {
            "id": self.id,
            "job_type": self.job_type,
            "stage": self.stage,
            "progress_percent": round(self.progress_percent, 1),
            "elapsed_seconds": elapsed,
            "estimated_remaining_seconds": remaining,
            "message": self.message,
            "error": self.error,
            "artifacts": self.artifacts,
            "result": self.result
        }

class JobManager:
    def __init__(self):
        self.jobs: Dict[str, Job] = {}

    def create_job(self, job_type: str, metadata: Optional[Dict[str, Any]] = None) -> Job:
        job = Job(job_type, metadata)
        self.jobs[job.id] = job
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        return self.jobs.get(job_id)

    def cancel_job(self, job_id: str) -> bool:
        job = self.jobs.get(job_id)
        if job and job.stage not in ["COMPLETED", "FAILED", "CANCELLED"]:
            job.cancel()
            return True
        return False

job_manager = JobManager()
