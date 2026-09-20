import { parseGalleryVideoUrl } from '../video'

describe('parseGalleryVideoUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=2IrOlyhoJ2w', '2IrOlyhoJ2w'],
    ['https://youtube.com/watch?v=2IrOlyhoJ2w&t=42s', '2IrOlyhoJ2w'],
    ['https://m.youtube.com/watch?v=2IrOlyhoJ2w', '2IrOlyhoJ2w'],
    ['https://youtu.be/2IrOlyhoJ2w?si=abc', '2IrOlyhoJ2w'],
    ['https://www.youtube.com/shorts/Kj-qMf5RRo4', 'Kj-qMf5RRo4'],
    ['https://www.youtube.com/embed/Kj-qMf5RRo4', 'Kj-qMf5RRo4'],
    ['https://www.youtube-nocookie.com/embed/Kj-qMf5RRo4', 'Kj-qMf5RRo4'],
  ])('reads the YouTube id from %s', (url, id) => {
    expect(parseGalleryVideoUrl(url)).toEqual({ provider: 'youtube', id })
  })

  it.each([
    ['https://www.loom.com/share/abc123def456', 'abc123def456'],
    ['https://loom.com/embed/abc123def456?autoplay=1', 'abc123def456'],
  ])('reads the Loom id from %s', (url, id) => {
    expect(parseGalleryVideoUrl(url)).toEqual({ provider: 'loom', id })
  })

  it.each([
    null,
    undefined,
    '',
    '   ',
    'not a url',
    'https://vimeo.com/123456789',
    'https://example.com/demo.mp4',
    'https://www.youtube.com/',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.loom.com/looms/videos',
    'https://evil.example/youtube.com/watch?v=2IrOlyhoJ2w',
    'javascript:alert(1)',
  ])('rejects %p', (value) => {
    expect(parseGalleryVideoUrl(value)).toBeNull()
  })
})
