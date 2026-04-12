#!/bin/bash
# Configure TeX Live tlmgr repository for runtime package installation
# This ensures tlmgr can install packages via the UI and auto-install features

# Detect installed TeX Live version
TEXLIVE_VERSION=$(ls /usr/local/texlive/ 2>/dev/null | grep -E '^[0-9]{4}$' | head -1)

if [ -z "$TEXLIVE_VERSION" ]; then
  echo "No TeX Live installation found, skipping repository configuration"
  exit 0
fi

# Use user-provided repo, or pick the right default based on whether
# the installed version matches the current CTAN year
if [ -n "$TEXLIVE_REPOSITORY" ]; then
  TEXLIVE_REPO="$TEXLIVE_REPOSITORY"
else
  # Try the main CTAN mirror first; if it rejects us (version mismatch),
  # fall back to the historic frozen archive for our version
  TEXLIVE_REPO="https://mirror.ctan.org/systems/texlive/tlnet"
  if ! tlmgr --repository "$TEXLIVE_REPO" option repository "$TEXLIVE_REPO" 2>&1 | grep -q "setting default"; then
    TEXLIVE_REPO="https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/${TEXLIVE_VERSION}/tlnet-final"
  fi
fi

echo "Configuring TeX Live ${TEXLIVE_VERSION} repository: ${TEXLIVE_REPO}"
tlmgr option repository "$TEXLIVE_REPO" 2>/dev/null || true

# Ensure www-data can write to texlive directory (needed for package installs)
if [ -d /usr/local/texlive ]; then
  chown -R www-data:www-data /usr/local/texlive
fi
