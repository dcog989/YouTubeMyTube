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
