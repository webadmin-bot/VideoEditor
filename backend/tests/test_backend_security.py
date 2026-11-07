#!/usr/bin/env python3
"""
Unit tests for backend security, safe path validation, Real-ESRGAN checks,
and output resolution aspect-ratio calculations.
"""

import sys
import unittest
from pathlib import Path
from backend.security import sanitize_filename, validate_safe_path, ALLOWED_STORAGE_DIRS, HTTPException
from backend.config import UPLOADS_DIR, RENDERS_DIR
from backend.engine.enhancer import (
    check_realesrgan_available, find_model_weights, build_enhancement_filter_string
)
from backend.install_realesrgan import compute_sha256, MODELS_CATALOG

class TestBackendSecurityAndIntegration(unittest.TestCase):

    def test_filename_sanitization(self):
        self.assertEqual(sanitize_filename("../../etc/passwd"), "passwd")
        self.assertEqual(sanitize_filename("..\\..\\windows\\system32\\cmd.exe"), "cmd.exe")
        self.assertNotIn("..", sanitize_filename("test..video.mp4"))
        self.assertTrue("my_cool_video.mp4" in sanitize_filename("my cool video.mp4"))

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
        status = check_realesrgan_available()
        self.assertIn("installed", status)
        self.assertIn("available", status)
        self.assertIn("models", status)
        self.assertIn("weights_dir", status)

        # If weights do not exist on disk, available must be False
        if not status["models"]:
            self.assertFalse(status["available"])
            self.assertIsNotNone(status["error"])

    def test_resolution_and_aspect_ratio_preservation(self):
        # Landscape 1080p target
        cfg_landscape_1080p = {"upscaleTarget": "1080p", "aiModel": "None"}
        filt_ls = build_enhancement_filter_string(cfg_landscape_1080p, source_width=1280, source_height=720)
        self.assertIn("scale=1920:1080:force_original_aspect_ratio=decrease", filt_ls)
        self.assertIn("scale=trunc(iw/2)*2:trunc(ih/2)*2", filt_ls)

        # Portrait 1080p target (vertical phone video e.g. 720x1280)
        filt_port_1080p = build_enhancement_filter_string(cfg_landscape_1080p, source_width=720, source_height=1280)
        self.assertIn("scale=1080:1920:force_original_aspect_ratio=decrease", filt_port_1080p)

        # 2K landscape and portrait
        cfg_2k = {"upscaleTarget": "2K", "aiModel": "None"}
        self.assertIn("scale=2560:1440:force_original_aspect_ratio=decrease", build_enhancement_filter_string(cfg_2k, 1920, 1080))
        self.assertIn("scale=1440:2560:force_original_aspect_ratio=decrease", build_enhancement_filter_string(cfg_2k, 1080, 1920))

        # 4K landscape and portrait
        cfg_4k = {"upscaleTarget": "4K", "aiModel": "None"}
        self.assertIn("scale=3840:2160:force_original_aspect_ratio=decrease", build_enhancement_filter_string(cfg_4k, 1920, 1080))
        self.assertIn("scale=2160:3840:force_original_aspect_ratio=decrease", build_enhancement_filter_string(cfg_4k, 1080, 1920))

    def test_enhancement_parameters_integration(self):
        # All frontend parameters reaching filter string
        cfg = {
            "contrast": 1.25,
            "brightness": -0.05,
            "saturation": 1.15,
            "denoiseStrength": 25,
            "sharpenStrength": 40,
            "upscaleTarget": "None",
            "aiModel": "None"
        }
        filt = build_enhancement_filter_string(cfg, 1920, 1080)
        self.assertIn("eq=contrast=1.25:brightness=-0.05:saturation=1.15", filt)
        self.assertIn("hqdn3d=2.5:2.5:4:4", filt)
        self.assertIn("unsharp=5:5:0.8:5:5:0.0", filt)

if __name__ == "__main__":
    unittest.main()
