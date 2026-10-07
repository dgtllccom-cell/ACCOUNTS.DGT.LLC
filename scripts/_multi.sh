#!/bin/bash
for P in "$@"; do
  ./scripts/_par.sh C:/Users/dgtll/AppData/Local/Temp/rs/gate4 "$P"
done
echo MULTI-DONE
