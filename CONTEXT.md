# Vocabulary

The words this app uses, and the ones it deliberately does not. Full glossary
lives in alexandria; this is the writing half.

## Writing

**Thought**:
A short, unattributed piece of one's own. No source, no page.
_Avoid_: post, status, tweet

**Note**:
An observation written down, usually while reading. May attach to a Work and
a page.
_Avoid_: annotation, highlight, marginalia

**Quote**:
Someone else's words, copied exactly. Always attributed; usually attached to a
Work and a page.
_Avoid_: excerpt, passage, snippet

**Essay**:
Long-form composition. Prose with embedded Quotes, Works and images, written
inline as `[[quote:UUID]]` tokens.
_Avoid_: article, post, piece

**Thread**:
Retired. Superseded by Essay. Still wired into the header and still shipping
~750 lines; worth its own decision, not this one's.

## Works — the half that lives elsewhere

**Work**:
Anything a Note or Quote can attach to — a Book, a lecture, an article, a
film. Owned by alexandria. stylus reads and writes them through the API and
holds none of them.
_Avoid_: item, resource, title

**Book**:
A Work whose kind is `book`. Not a separate entity.

**Creator**:
The person a Work is attributed to. The API still calls this field `author`.

## The boundary

**Works** is the record of what exists in the world: true regardless of who is
reading it, readable by anyone signed in, writable by admin only.

**Writing** is what a person has set down themselves: private to whoever wrote
it. It points at Works. Works never points back.
