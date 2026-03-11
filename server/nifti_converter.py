#!/usr/bin/env python3
"""
NIfTI Converter for SpineGuardAI
Converts JPEG/PNG medical images to NIfTI format for medical imaging analysis.
"""

import sys
import argparse
import numpy as np
import nibabel as nib
from PIL import Image
from pathlib import Path
from typing import cast, Union, List, Any


def convert_image_to_nifti(image_path: str, output_path: str) -> str:
    """
    Convert a 2D medical image (JPEG/PNG) to NIfTI format.
    
    Args:
        image_path: Path to input image file
        output_path: Path for output NIfTI file
        
    Returns:
        Path to created NIfTI file
    """
    # Load image
    img = Image.open(image_path)
    
    # Convert to grayscale if needed
    if img.mode != 'L':
        img = img.convert('L')
    
    # Convert to numpy array
    img_array = np.array(img, dtype=np.float32)
    
    # Normalize to 0-1 range
    img_array = img_array / 255.0
    
    # For 2D images, create a pseudo-3D volume by adding a depth dimension
    # This simulates a single-slice MRI scan
    img_3d = np.expand_dims(img_array, axis=2)
    
    # Create affine transformation matrix (identity for now)
    # In real DICOM conversion, this would include spatial information
    affine = cast(np.ndarray, np.eye(4))
    
    # Set voxel spacing (1mm isotropic for simplicity)
    affine[0, 0] = 1.0  # x spacing
    affine[1, 1] = 1.0  # y spacing
    affine[2, 2] = 1.0  # z spacing
    
    # Create NIfTI image
    nifti_img = nib.Nifti1Image(img_3d, affine)
    
    # Save NIfTI file
    nib.save(nifti_img, output_path)
    
    print(f"Converted {image_path} to NIfTI format: {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(
        description='Convert medical images to NIfTI format'
    )
    parser.add_argument('--input', required=True, help='Input image file (JPEG/PNG)')
    parser.add_argument('--output', required=True, help='Output NIfTI file (.nii or .nii.gz)')
    
    args = parser.parse_args()
    
    # Create output directory if needed
    output_dir = Path(args.output).parent
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Convert image
    try:
        nifti_path = convert_image_to_nifti(args.input, args.output)
        print(f"Success: {nifti_path}")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
