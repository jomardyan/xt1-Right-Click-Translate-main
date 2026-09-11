SHELL := /bin/sh

PACKAGE_NAME := xt1-translate-v$(shell jq -r '.version' manifest.json)
DIST_DIR := dist
PACKAGE_FILE := $(DIST_DIR)/$(PACKAGE_NAME).zip

PACKAGE_FILES := \
	manifest.json \
	background.js \
	content.js \
	options.js \
	options.html \
	options.css \
	popup.js \
	popup.html \
	popup.css \
	icons/ \
	_locales/ \
	vendor/

.PHONY: package clean FORCE

package: $(PACKAGE_FILE)
	@printf 'Created %s\n' '$(PACKAGE_FILE)'

$(PACKAGE_FILE): FORCE $(PACKAGE_FILES)
	@mkdir -p '$(DIST_DIR)'
	@rm -f '$@'
	@zip -rq '$@' $(PACKAGE_FILES)

FORCE:

clean:
	@rm -rf '$(DIST_DIR)'
