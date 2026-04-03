#!/bin/bash
rsync -vhrla --exclude .git/ --exclude .beads/ --exclude '*.md' $PWD/ timothason:/var/www/borchardlabs.com
