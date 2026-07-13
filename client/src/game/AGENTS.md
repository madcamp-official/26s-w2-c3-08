# Phaser Boundary Rules

This directory contains protected gameplay code.

- Preserve rendering, physics, collision, gameplay timing, race rules, and map rules.
- UI tasks may change only:
  - React wrapper contracts
  - lifecycle cleanup
  - resize integration
  - typed bridge events
  - accessibility-related surrounding UI
- Do not rewrite a Phaser scene merely to match a Figma screenshot.
- Do not convert Phaser-rendered gameplay into React DOM.
- Do not change freeze penalties, overtime, ranking, placement validation, or map locking without an explicit gameplay task.
- Whenever this directory changes, report exactly which runtime behavior may be affected.