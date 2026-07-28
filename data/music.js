/* ============================================================
   爵士乐播放列表
   -------------------------------------------------------------
   Kind of Blue — Miles Davis (1959)
   + Coltrane / Bill Evans / Cannonball / Sakamoto / Hisaishi 等
   文件：uploads/music/*.mp3
   封面：uploads/music/covers/*.jpg（1:1）
   ============================================================ */
window.MUSIC_LIST = [
  // ---- Kind of Blue — Miles Davis (1959) ----
  {
    title: 'So What',
    artist: 'Miles Davis · Kind of Blue',
    album: 'Kind of Blue',
    year: 1959,
    track: 1,
    file: 'so-what.mp3',
    cover: 'so-what.jpg',
    tint: '#1a2a4a'
  },
  {
    title: 'Freddie Freeloader',
    artist: 'Miles Davis · Kind of Blue',
    album: 'Kind of Blue',
    year: 1959,
    track: 2,
    file: 'freddie-freeloader.mp3',
    cover: 'freddie-freeloader.jpg',
    tint: '#1a2a4a'
  },
  {
    title: 'Blue in Green',
    artist: 'Miles Davis · Kind of Blue',
    album: 'Kind of Blue',
    year: 1959,
    track: 3,
    file: 'blue-in-green.mp3',
    cover: 'blue-in-green.jpg',
    tint: '#1a2a4a'
  },
  {
    title: 'All Blues',
    artist: 'Miles Davis · Kind of Blue',
    album: 'Kind of Blue',
    year: 1959,
    track: 4,
    file: 'all-blues.mp3',
    cover: 'all-blues.jpg',
    tint: '#1a2a4a'
  },
  {
    title: 'Flamenco Sketches',
    artist: 'Miles Davis · Kind of Blue',
    album: 'Kind of Blue',
    year: 1959,
    track: 5,
    file: 'flamenco-sketches.mp3',
    cover: 'flamenco-sketches.jpg',
    tint: '#1a2a4a'
  },
  {
    title: 'Flamenco Sketches (Alternate Take)',
    artist: 'Miles Davis · Kind of Blue',
    album: 'Kind of Blue',
    year: 1959,
    track: 6,
    file: 'flamenco-sketches-alt.mp3',
    cover: 'flamenco-sketches-alt.jpg',
    tint: '#1a2a4a'
  },

  // ---- Bill Evans ----
  {
    title: 'It Must Be Love',
    artist: 'Bill Evans',
    album: 'Bill Evans',
    year: null,
    track: 7,
    file: 'it-must-be-love.mp3',
    cover: 'it-must-be-love.jpg',
    tint: '#2c3e50'
  },
  {
    title: 'My Foolish Heart',
    artist: 'Bill Evans · Waltz for Debby',
    album: 'Waltz for Debby',
    year: 1961,
    track: 8,
    file: 'my-foolish-heart.mp3',
    cover: 'my-foolish-heart.jpg',
    tint: '#3d2b1f'
  },
  {
    title: 'Soirée',
    artist: 'Bill Evans',
    album: 'Bill Evans',
    year: null,
    track: 9,
    file: 'soiree.mp3',
    cover: 'soiree.jpg',
    tint: '#4a3728'
  },
  {
    title: 'Skating In Central Park',
    artist: 'Bill Evans & Jim Hall · Undercurrent',
    album: 'Undercurrent',
    year: 1962,
    track: 10,
    file: 'skating-in-central-park.mp3',
    cover: 'skating-in-central-park.jpg',
    tint: '#1a3040'
  },

  // ---- Cannonball Adderley ----
  {
    title: 'Autumn Leaves',
    artist: "Cannonball Adderley · Somethin' Else",
    album: "Somethin' Else",
    year: 1958,
    track: 11,
    file: 'autumn-leaves.mp3',
    cover: 'autumn-leaves.jpg',
    tint: '#5c3317'
  },
  {
    title: 'Dancing in the Dark',
    artist: "Cannonball Adderley · Somethin' Else",
    album: "Somethin' Else",
    year: 1958,
    track: 12,
    file: 'dancing-in-the-dark.mp3',
    cover: 'dancing-in-the-dark.jpg',
    tint: '#5c3317'
  },
  {
    title: 'Mercy, Mercy, Mercy (Live)',
    artist: 'Cannonball Adderley · Mercy, Mercy, Mercy!',
    album: 'Mercy, Mercy, Mercy!',
    year: 1966,
    track: 13,
    file: 'mercy-mercy-mercy.mp3',
    cover: 'mercy-mercy-mercy.jpg',
    tint: '#8b4513'
  },

  // ---- John Coltrane ----
  {
    title: 'Giant Steps',
    artist: 'John Coltrane · Giant Steps',
    album: 'Giant Steps',
    year: 1960,
    track: 14,
    file: 'giant-steps.mp3',
    cover: 'giant-steps.jpg',
    tint: '#0d1b2a'
  },
  {
    title: 'My One and Only Love',
    artist: 'John Coltrane & Johnny Hartman',
    album: 'John Coltrane and Johnny Hartman',
    year: 1963,
    track: 15,
    file: 'my-one-and-only-love.mp3',
    cover: 'my-one-and-only-love.jpg',
    tint: '#2c1810'
  },
  {
    title: 'My Little Brown Book',
    artist: 'Duke Ellington & John Coltrane',
    album: 'Duke Ellington & John Coltrane',
    year: 1963,
    track: 16,
    file: 'my-little-brown-book.mp3',
    cover: 'my-little-brown-book.jpg',
    tint: '#2f1b0c'
  },
  {
    title: 'A Love Supreme, Pt. I – Acknowledgement',
    artist: 'John Coltrane · A Love Supreme',
    album: 'A Love Supreme',
    year: 1965,
    track: 17,
    file: 'a-love-supreme-pt1.mp3',
    cover: 'a-love-supreme-pt1.jpg',
    tint: '#1a1a2e'
  },
  {
    title: 'A Love Supreme, Pt. II – Resolution',
    artist: 'John Coltrane · A Love Supreme',
    album: 'A Love Supreme',
    year: 1965,
    track: 18,
    file: 'a-love-supreme-pt2.mp3',
    cover: 'a-love-supreme-pt2.jpg',
    tint: '#1a1a2e'
  },

  // ---- Soundtrack / other ----
  {
    title: 'The Last Emperor (Main Title Theme)',
    artist: 'David Byrne · The Last Emperor',
    album: 'The Last Emperor',
    year: 1987,
    track: 19,
    file: 'the-last-emperor.mp3',
    cover: 'the-last-emperor.jpg',
    tint: '#8b0000'
  },
  {
    title: 'Merry Christmas Mr. Lawrence',
    artist: 'Ryuichi Sakamoto · Merry Christmas, Mr. Lawrence',
    album: 'Merry Christmas, Mr. Lawrence',
    year: 1983,
    track: 20,
    file: 'merry-christmas-mr-lawrence.mp3',
    cover: 'merry-christmas-mr-lawrence.jpg',
    tint: '#1b3a4b'
  },
  {
    title: 'Rain (I Want A Divorce)',
    artist: 'Ryuichi Sakamoto · Merry Christmas, Mr. Lawrence',
    album: 'Merry Christmas, Mr. Lawrence',
    year: 1983,
    track: 21,
    file: 'rain-i-want-a-divorce.mp3',
    cover: 'rain-i-want-a-divorce.jpg',
    tint: '#1b3a4b'
  },
  {
    title: '紅の豚 Madness (Live)',
    artist: 'Joe Hisaishi · Porco Rosso',
    album: 'Porco Rosso',
    year: 1992,
    track: 22,
    file: 'porco-rosso-madness.mp3',
    cover: 'porco-rosso-madness.jpg',
    tint: '#8b2500'
  },
  {
    title: 'Porco Rosso (il porco rosso)',
    artist: 'Joe Hisaishi · Porco Rosso',
    album: 'Porco Rosso',
    year: 1992,
    track: 23,
    file: 'porco-rosso-theme.mp3',
    cover: 'porco-rosso-theme.jpg',
    tint: '#8b2500'
  }
];
