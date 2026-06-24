#!/bin/bash
# set-sim-time.sh
# Sets the simulation time for libfaketime

if [ -z "$1" ]; then
  echo "Usage: ./set-sim-time.sh \"@2026-10-10 14:00:00\" or \"+30d\""
  exit 1
fi

mkdir -p scratch/faketime
echo "$1" > scratch/faketime/faketime.rc
echo "Simulation time set to $1"
