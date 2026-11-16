# Verify the repo: the same checks CI runs.
default: check

# Full check, the same command CI runs.
check:
    bun run check

# Linter alone.
lint:
    bunx biome check .

# Rewrite formatting and lint fixes.
format:
    bun run fix

# Test suite.
test:
    bun run test

# Production build.
build:
    bun run build

# esbuild watch loop.
dev:
    bun run watch

# Remove build output and dependencies.
clean:
    bun run clean

# Refresh dependencies to their latest allowed versions.
update:
    bun run update

# package.json script: build:chrome.
build-chrome:
    bun run build:chrome

# package.json script: build:firefox.
build-firefox:
    bun run build:firefox

# package.json script: hooks:install.
hooks:
    bun run hooks:install

# package.json script: icons.
icons:
    bun run icons

# package.json script: lint:webext (downloads web-ext on a cold cache).
lint-webext:
    bun run lint:webext

# package.json script: test:coverage.
coverage:
    bun run test:coverage

# package.json script: typecheck.
typecheck:
    bun run typecheck

# package.json script: typecheck:watch.
typecheck-watch:
    bun run typecheck:watch

# Bump the version from conventional commits and tag it.
release:
    cog bump --auto

# Biome over a file list, as the pre-commit hook passes it.
format-staged *files:
    bunx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true {{files}}

# Verify a commit message file, as the commit-msg hook passes it.
commit-check file *args:
    cog verify --file {{file}} {{args}}
