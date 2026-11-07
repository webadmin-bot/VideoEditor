#!/usr/bin/env python3
"""
Unit tests for backend security, safe path validation, and Real-ESRGAN checks.
"""

import sys
import unittest
from pathlib import Path
from backend.security import sanitize_filename, validate_safe_path, ALLOWED_STORAGE_DIRS, HTTPException
from backend.config import UPLOADS_DIR, RENDERS_DIR
from backend.engine.enhancer import check_realesrgan_available, find_model_weights


class TestBackendSecurityAndIntegration(unittest.TestCase):

    def test_filename_sanitization(self):
        self.assertEqual(sanitize_filename("../../etc/passwd"), "passwd")
        self.assertEqual(sanitize_filename("..\\..\\windows\\system32\\cmd.exe"), "cmd.exe")
        self.assertNotIn("..", sanitize_filename("test..video.mp4"))
        self.assertTrue(sanitize_filename("my cool video.mp4").startswith("my_cool_video.mp4") or "my cool video" in sanitize_filename("my cool video.mp4"))

    def test_path_traversal_prevention(self):
        # Valid path inside uploads
        valid_path = str(UPLOADS_DIR / "sample.mp4")
        resolved = validate_safe_path(valid_path)
        self.assertEqual(resolved, (UPLOADS_DIR / "sample.mp4").resolve())

        # Arbitrary system file should be blocked with 403
        with self.assertRaises(HTTPException) as ctx:
            validate_safe_path("/etc/passwd")
        self.assertEqual(ctx.exception.status_code, 403)

        # Windows system directory traversal should be blocked
        with self.assertRaises(HTTPException) as ctx:
            validate_safe_path("C:\\Windows\\System32\\drivers\\etc\\hosts")
        self.assertEqual(ctx.exception.status_code, 403)

        # Relative parent traversal out of allowed directory should be blocked
        with self.assertRaises(HTTPException) as ctx:
            validate_safe_path(str(UPLOADS_DIR / ".." / ".." / "package.json"))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_realesrgan_weights_validation(self):
        # check_realesrgan_available should accurately report status
        status = check_realesrgan_available()
        self.assertIn("installed", status)
        self.assertIn("available", status)
        self.assertIn("models", status)
        self.assertIn("weights_dir", status)

        # If weights do not exist on disk, available must be False
        if not status["models"]:
            self.assertFalse(status["available"])
            self.assertIsNotNone(status["error"])

if __name__ == "__main__":
    unittest.main()
