NODE ?= node
NPM ?= npm
DIST_DIR ?= dist
ZIP ?= zip
TAR ?= tar
.DEFAULT_GOAL := help
.NOTPARALLEL:
PACKAGE_NAME = xt1-translate-v$(shell "$(NODE)" -p "require('./manifest.json').version")
PACKAGE_FILE = $(DIST_DIR)/$(PACKAGE_NAME).zip
empty :=
space := $(empty) $(empty)
escape = $(subst $(space),\$(space),$(1))
PACKAGE_FILES := manifest.json background.js content.js options.js options.html options.css popup.js popup.html popup.css icons/ _locales/ vendor/ LICENSE COPYRIGHT.md
.PHONY: help install dev test lint check build package clean FORCE guard-dist security
help: ## List source validation, test and local ZIP commands
	@"$(NODE)" scripts/make-support.mjs help
install: ## Install locked test tools without lifecycle scripts
	"$(NPM)" ci --ignore-scripts
test: ## Run Jest in one process
	"$(NPM)" test -- --runInBand
lint: ## Syntax-check every extension JavaScript entry point
	"$(NODE)" --check background.js
	"$(NODE)" --check content.js
	"$(NODE)" --check options.js
	"$(NODE)" --check popup.js
build: lint ## Validate this source-based extension; no compilation is required
check: lint test ## Run source validation and tests
dev: build ## Print unpacked extension development instructions
	@"$(NODE)" -e "console.log('Load this directory using Load unpacked at chrome://extensions/; reload after editing.')"
guard-dist:
	@"$(NODE)" scripts/make-support.mjs guard "$(DIST_DIR)"
package: $(call escape,$(PACKAGE_FILE)) ## Create a local extension ZIP with license and copyright
	@"$(NODE)" -e "console.log('Created: ' + process.argv[1])" "$(PACKAGE_FILE)"
$(call escape,$(PACKAGE_FILE)): build guard-dist FORCE $(PACKAGE_FILES)
	@"$(NODE)" scripts/make-support.mjs mkdir "$(DIST_DIR)"
	@"$(NODE)" scripts/make-support.mjs clean "$@"
ifeq ($(OS),Windows_NT)
	"$(TAR)" -a -c -f "$@" $(PACKAGE_FILES)
else
	"$(ZIP)" -rq "$@" $(PACKAGE_FILES)
endif
FORCE:
clean: guard-dist ## Remove only the guarded generated ZIP output directory
	"$(NODE)" scripts/make-support.mjs clean "$(DIST_DIR)"
security: ## Audit production dependency advisories
	"$(NPM)" audit --omit=dev --audit-level=moderate
