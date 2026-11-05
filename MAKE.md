# GNU Make workflow

Run `make` or `make help` to list the project commands. The default only prints help; it does not install, build, publish or start a server. Use GNU Make; executable variables accept a single executable path, including spaces (put flags in the documented argument variables).

This extension runs from source; build validates JavaScript. Packaging uses Windows bsdtar or Unix zip and includes the existing license/notices. DIST_DIR may be a generated descendant of dist, including paths with spaces. clean rejects source/outside paths.

On Windows, Bash-based Makefiles default to Git for Windows under ProgramFiles; override `BASH="C:/path/to/bash.exe"` for another installation. Other projects keep their native command dispatcher. Use `make -n TARGET` to inspect recipes before optional setup, server, package or release operations; a dry run is not evidence that those operations passed.

Generated-output cleanup validates containment and refuses tracked source or symlink/junction targets where its helper is used. No clean target is intended to remove dependency installations, merchant/user files, settings, credentials or production databases. Install explicit development dependencies before running validation. Security audit commands preserve scanner failures and may need network access.
