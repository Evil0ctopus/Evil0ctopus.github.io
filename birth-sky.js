/**
 * Birth Sky — client-only curiosity tool for Evil0ctopus.
 * Geocode: Nominatim. Timezone: tz-lookup. Sky: VirtualSky. Wheel/facts: Astronomy Engine.
 * History/place snippets: Wikimedia / Wikipedia (best-effort; never invented).
 */
(function () {
  'use strict';

  // Nominatim sees the browser User-Agent + Referer (UA header is forbidden in fetch).
  var SIGNS = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
  ];
  var SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  var BODIES = [
    { key: 'Sun', body: 'Sun', glyph: '☉' },
    { key: 'Moon', body: 'Moon', glyph: '☽' },
    { key: 'Mercury', body: 'Mercury', glyph: '☿' },
    { key: 'Venus', body: 'Venus', glyph: '♀' },
    { key: 'Mars', body: 'Mars', glyph: '♂' },
    { key: 'Jupiter', body: 'Jupiter', glyph: '♃' },
    { key: 'Saturn', body: 'Saturn', glyph: '♄' },
    { key: 'Uranus', body: 'Uranus', glyph: '♅' },
    { key: 'Neptune', body: 'Neptune', glyph: '♆' },
    { key: 'Pluto', body: 'Pluto', glyph: '♇' }
  ];

  var form = document.getElementById('birth-sky-form');
  var dateInput = document.getElementById('birth-date');
  var timeInput = document.getElementById('birth-time');
  var placeInput = document.getElementById('birth-place');
  var placeResults = document.getElementById('place-results');
  var formError = document.getElementById('form-error');
  var loading = document.getElementById('loading');
  var results = document.getElementById('results');
  var resultsMeta = document.getElementById('results-meta');
  var generateBtn = document.getElementById('generate-btn');
  var resetBtn = document.getElementById('reset-btn');
  var starmapEl = document.getElementById('starmap');
  var natalEl = document.getElementById('natal-chart');
  var planetListEl = document.getElementById('planet-list');
  var factsListEl = document.getElementById('special-facts-list');
  var factsLoadingEl = document.getElementById('special-facts-loading');
  var factsNoteEl = document.getElementById('special-facts-note');

  var planetarium = null;
  var pendingPlaces = null;
  var selectedPlace = null;

  function showError(msg) {
    formError.hidden = false;
    formError.textContent = msg;
  }

  function clearError() {
    formError.hidden = true;
    formError.textContent = '';
  }

  function setLoading(on) {
    loading.hidden = !on;
    generateBtn.disabled = on;
  }

  function hidePlacePicker() {
    placeResults.hidden = true;
    placeResults.innerHTML = '';
    pendingPlaces = null;
  }

  function lonToSign(lon) {
    var n = ((lon % 360) + 360) % 360;
    var idx = Math.floor(n / 30);
    var deg = n - idx * 30;
    return {
      index: idx,
      name: SIGNS[idx],
      glyph: SIGN_GLYPHS[idx],
      degree: deg,
      absolute: n
    };
  }

  function formatDeg(deg) {
    var d = Math.floor(deg);
    var m = Math.floor((deg - d) * 60);
    return d + '°' + (m < 10 ? '0' : '') + m + '′';
  }

  /**
   * Convert a wall-clock local datetime in an IANA timezone to a UTC Date.
   */
  function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
    // Convert a wall-clock time in `timeZone` to an absolute UTC Date.
    var want = Date.UTC(year, month - 1, day, hour, minute, 0);
    var utc = want;
    var formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });
    for (var i = 0; i < 3; i++) {
      var parts = formatter.formatToParts(new Date(utc));
      var map = {};
      for (var j = 0; j < parts.length; j++) {
        if (parts[j].type !== 'literal') map[parts[j].type] = parts[j].value;
      }
      var asShown = Date.UTC(
        +map.year,
        +map.month - 1,
        +map.day,
        +map.hour,
        +map.minute,
        +map.second
      );
      utc = utc + (want - asShown);
    }
    return new Date(utc);
  }

  async function geocodePlace(query) {
    var url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=' +
      encodeURIComponent(query);
    // Browsers forbid setting User-Agent; Nominatim still sees the browser UA + our Referer.
    // Identify the app in a query param for logs / policy compliance.
    var res = await fetch(url + '&addressdetails=0', {
      headers: {
        Accept: 'application/json'
      }
    });
    if (!res.ok) {
      throw new Error('Place lookup failed (' + res.status + '). Try again in a moment.');
    }
    var data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('No places found for “' + query + '”. Try a city and region (e.g. Potosi, Missouri).');
    }
    return data.map(function (item) {
      return {
        display: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon)
      };
    });
  }

  function lookupTimezone(lat, lon) {
    try {
      if (typeof tzlookup === 'function') {
        var tz = tzlookup(lat, lon);
        if (tz) {
          return { timeZone: tz, label: tz, fallbackOffsetHours: null };
        }
      }
    } catch (e) { /* fall through */ }
    var hours = Math.round(lon / 15);
    return {
      timeZone: 'UTC',
      label: 'approx UTC' + (hours === 0 ? '' : (hours > 0 ? '+' : '') + hours) + ' (from longitude)',
      fallbackOffsetHours: hours
    };
  }

  function buildWhen(dateStr, timeStr, tzInfo) {
    var parts = dateStr.split('-').map(Number);
    var y = parts[0];
    var mo = parts[1];
    var d = parts[2];
    var assumedNoon = !timeStr;
    var hh = 12;
    var mm = 0;
    if (timeStr) {
      var t = timeStr.split(':').map(Number);
      hh = t[0];
      mm = t[1] || 0;
    }

    var when;
    if (tzInfo.fallbackOffsetHours != null && tzInfo.timeZone === 'UTC') {
      // Local wall time minus offset ≈ UTC (offset hours east of Greenwich positive in our fallback)
      when = new Date(Date.UTC(y, mo - 1, d, hh - tzInfo.fallbackOffsetHours, mm, 0));
    } else {
      when = zonedTimeToUtc(y, mo, d, hh, mm, tzInfo.timeZone);
    }

    return { when: when, assumedNoon: assumedNoon, localLabel: dateStr + ' ' + (assumedNoon ? '12:00 (assumed noon)' : timeStr) };
  }

  function destroyPlanetarium() {
    if (planetarium && typeof planetarium.destroy === 'function') {
      try { planetarium.destroy(); } catch (e) { /* ignore */ }
    }
    planetarium = null;
    starmapEl.innerHTML = '';
  }

  function renderSky(lat, lon, when) {
    destroyPlanetarium();
    // VirtualSky reads size from the element; ensure layout exists
    starmapEl.style.width = '100%';
    if (typeof S === 'undefined' || !S.virtualsky) {
      throw new Error('Sky library failed to load. Check your connection and refresh.');
    }
    planetarium = S.virtualsky({
      id: 'starmap',
      projection: 'stereo',
      latitude: lat,
      longitude: lon,
      clock: when,
      constellations: true,
      constellationlabels: true,
      showplanets: true,
      showplanetlabels: true,
      showstars: true,
      showstarlabels: true,
      ground: true,
      cardinalpoints: true,
      showdate: true,
      showposition: true,
      keyboard: true,
      mouse: true,
      az: 180,
      magnitude: 5.5,
      scalestars: 1.1,
      fontsize: '11px',
      fontfamily: 'system-ui, sans-serif',
      color: 'rgb(200,230,255)',
      lang: 'en'
    });
  }

  function bodyEclipticLongitude(bodyEnum, when) {
    // Geocentric true ecliptic-of-date longitude (natal-chart style).
    // EclipticLongitude() rejects the Sun; GeoVector + Ecliptic works for all.
    var vec = Astronomy.GeoVector(bodyEnum, when, true);
    var ect = Astronomy.Ecliptic(vec);
    return ect.elon;
  }

  function computeNatal(when) {
    if (typeof Astronomy === 'undefined') {
      throw new Error('Astronomy Engine failed to load. Check your connection and refresh.');
    }
    return BODIES.map(function (b) {
      var lon = bodyEclipticLongitude(Astronomy.Body[b.body], when);
      var sign = lonToSign(lon);
      return {
        key: b.key,
        glyph: b.glyph,
        lon: lon,
        sign: sign
      };
    });
  }

  function renderNatalChart(placements) {
    var size = 360;
    var cx = size / 2;
    var cy = size / 2;
    var rOuter = 168;
    var rInner = 118;
    var rPlanet = 138;

    // Astrology wheels traditionally put 0° Aries at the left (9 o'clock) going counter-clockwise.
    function lonToAngle(lon) {
      // SVG: 0° is east, clockwise. Convert: θ_svg = 180° - lon
      return ((180 - lon) * Math.PI) / 180;
    }

    var rings = '';
    rings += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rOuter + '" fill="#0b0f14" stroke="#22d3ee" stroke-width="2"/>';
    rings += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rInner + '" fill="#121820" stroke="#334155" stroke-width="1.5"/>';
    rings += '<circle cx="' + cx + '" cy="' + cy + '" r="36" fill="#0b0f14" stroke="#243041" stroke-width="1"/>';

    var wedges = '';
    for (var i = 0; i < 12; i++) {
      var a0 = lonToAngle(i * 30);
      var a1 = lonToAngle((i + 1) * 30);
      var x0o = cx + rOuter * Math.cos(a0);
      var y0o = cy + rOuter * Math.sin(a0);
      var x1o = cx + rOuter * Math.cos(a1);
      var y1o = cy + rOuter * Math.sin(a1);
      var x0i = cx + rInner * Math.cos(a0);
      var y0i = cy + rInner * Math.sin(a0);
      wedges +=
        '<line x1="' + x0i + '" y1="' + y0i + '" x2="' + x0o + '" y2="' + y0o + '" stroke="#334155" stroke-width="1"/>';
      var amid = lonToAngle(i * 30 + 15);
      var lx = cx + ((rOuter + rInner) / 2) * Math.cos(amid);
      var ly = cy + ((rOuter + rInner) / 2) * Math.sin(amid);
      wedges +=
        '<text x="' + lx + '" y="' + ly + '" text-anchor="middle" dominant-baseline="middle" fill="#94a3b8" font-size="13">' +
        SIGN_GLYPHS[i] +
        '</text>';
    }

    // Stack planets that share a sign slightly
    var bySign = {};
    var planetMarks = '';
    placements.forEach(function (p) {
      var si = p.sign.index;
      if (!bySign[si]) bySign[si] = 0;
      var slot = bySign[si]++;
      var lon = p.sign.absolute + slot * 2.2;
      var ang = lonToAngle(lon);
      var px = cx + rPlanet * Math.cos(ang);
      var py = cy + rPlanet * Math.sin(ang);
      planetMarks +=
        '<text x="' + px + '" y="' + py + '" text-anchor="middle" dominant-baseline="middle" fill="#22d3ee" font-size="14" font-weight="600">' +
        p.glyph +
        '</text>';
      planetMarks +=
        '<title>' + p.key + ' in ' + p.sign.name + ' ' + formatDeg(p.sign.degree) + '</title>';
    });

    var centerLabel =
      '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" fill="#e8eef6" font-size="11" font-family="system-ui,sans-serif">Natal</text>' +
      '<text x="' + cx + '" y="' + (cy + 10) + '" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="system-ui,sans-serif">symbolic</text>';

    natalEl.innerHTML =
      '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Symbolic natal chart wheel">' +
      rings +
      wedges +
      planetMarks +
      centerLabel +
      '</svg>';

    planetListEl.innerHTML = placements
      .map(function (p) {
        return (
          '<li><span class="pl-name">' +
          p.glyph +
          ' ' +
          p.key +
          '</span><span class="pl-sign">' +
          p.sign.name +
          ' ' +
          formatDeg(p.sign.degree) +
          '</span></li>'
        );
      })
      .join('');
  }


  var NAKED_EYE = [
    { key: 'Mercury', body: 'Mercury' },
    { key: 'Venus', body: 'Venus' },
    { key: 'Mars', body: 'Mars' },
    { key: 'Jupiter', body: 'Jupiter' },
    { key: 'Saturn', body: 'Saturn' }
  ];

  function moonPhaseName(phaseDeg, fraction) {
    // Combine phase angle (waxing vs waning) with illumination fraction for friendly labels.
    var p = ((phaseDeg % 360) + 360) % 360;
    var frac = typeof fraction === 'number' ? fraction : 0.5;
    var waxing = p < 180;
    if (frac < 0.03) return 'New Moon';
    if (frac > 0.97) return 'Full Moon';
    if (frac >= 0.45 && frac <= 0.55) return waxing ? 'First Quarter' : 'Last Quarter';
    if (frac < 0.45) return waxing ? 'Waxing Crescent' : 'Waning Crescent';
    return waxing ? 'Waxing Gibbous' : 'Waning Gibbous';
  }

  function seasonNote(when, lat) {
    var m = when.getUTCMonth() + 1;
    // Rough meteorological seasons by month; flip for southern hemisphere
    var north;
    if (m === 12 || m === 1 || m === 2) north = 'winter';
    else if (m >= 3 && m <= 5) north = 'spring';
    else if (m >= 6 && m <= 8) north = 'summer';
    else north = 'autumn';

    var southMap = { winter: 'summer', spring: 'autumn', summer: 'winter', autumn: 'spring' };
    if (Math.abs(lat) < 12) {
      return 'Near the equator, day and night stay close in length year-round — a gently even sky clock.';
    }
    if (lat >= 0) {
      return 'In the Northern Hemisphere it was ' + north + ' season around that date.';
    }
    return 'In the Southern Hemisphere it was ' + southMap[north] + ' season around that date.';
  }

  function computeAstronomyFacts(when, lat, lon) {
    var facts = [];
    if (typeof Astronomy === 'undefined') return facts;

    try {
      var phaseDeg = Astronomy.MoonPhase(when);
      var illum = Astronomy.Illumination(Astronomy.Body.Moon, when);
      var pct = Math.round((illum.phase_fraction || 0) * 100);
      facts.push({
        tag: 'astronomy',
        text:
          'The Moon was a ' +
          moonPhaseName(phaseDeg, illum.phase_fraction) +
          ', about ' +
          pct +
          '% illuminated — a real glow (or hush) over that night’s sky.'
      });
    } catch (e) { /* skip moon */ }

    try {
      var observer = new Astronomy.Observer(lat, lon, 0);
      var up = [];
      NAKED_EYE.forEach(function (p) {
        try {
          var equ = Astronomy.Equator(Astronomy.Body[p.body], when, observer, true, true);
          var hor = Astronomy.Horizon(when, observer, equ.ra, equ.dec, 'normal');
          if (hor.altitude > 0) {
            var magInfo = Astronomy.Illumination(Astronomy.Body[p.body], when);
            up.push({ name: p.key, alt: hor.altitude, mag: magInfo.mag });
          }
        } catch (err) { /* skip body */ }
      });
      up.sort(function (a, b) { return a.mag - b.mag; });
      if (up.length) {
        var names = up.map(function (u) { return u.name; });
        var brightest = up[0];
        var phrase;
        if (names.length === 1) {
          phrase = names[0] + ' was above the horizon';
        } else if (names.length === 2) {
          phrase = names[0] + ' and ' + names[1] + ' were above the horizon';
        } else {
          phrase =
            names.slice(0, -1).join(', ') +
            ', and ' +
            names[names.length - 1] +
            ' were above the horizon';
        }
        facts.push({
          tag: 'astronomy',
          text:
            'Naked-eye planets: ' +
            phrase +
            '. Brightest among them: ' +
            brightest.name +
            ' (mag ' +
            brightest.mag.toFixed(1) +
            ').'
        });
      } else {
        facts.push({
          tag: 'astronomy',
          text:
            'None of the classic naked-eye planets (Mercury through Saturn) sat above the horizon at that exact moment — the sky’s guest list was quieter.'
        });
      }
    } catch (e2) { /* skip planets */ }

    try {
      var sunLon = bodyEclipticLongitude(Astronomy.Body.Sun, when);
      var sunSign = lonToSign(sunLon);
      facts.push({
        tag: 'astronomy',
        text:
          'The Sun was traveling through the sky’s ' +
          sunSign.name +
          ' season (an astronomy calendar note — not a horoscope prediction).'
      });
    } catch (e3) { /* skip sun */ }

    try {
      var season = seasonNote(when, lat);
      if (season) {
        facts.push({ tag: 'astronomy', text: season });
      }
    } catch (e4) { /* skip season */ }

    // Cap at 4 astronomy bullets
    return facts.slice(0, 4);
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  async function fetchOnThisDay(month, day) {
    var mm = pad2(month);
    var dd = pad2(day);
    var base = 'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/';
    var headers = { Accept: 'application/json' };

    async function load(kind) {
      var res = await fetch(base + kind + '/' + mm + '/' + dd, { headers: headers });
      if (!res.ok) throw new Error('history ' + res.status);
      var data = await res.json();
      var list = data[kind];
      return Array.isArray(list) ? list : [];
    }

    var items = [];
    try {
      items = await load('selected');
    } catch (e) {
      items = [];
    }
    if (!items.length) {
      try {
        items = await load('events');
      } catch (e2) {
        return { ok: false, facts: [] };
      }
    }
    if (!items.length) return { ok: true, facts: [] };

    // Prefer entries with a year and a usable text
    var scored = items
      .filter(function (it) {
        return it && typeof it.text === 'string' && it.text.trim().length > 20;
      })
      .map(function (it) {
        var year = typeof it.year === 'number' ? it.year : null;
        var text = it.text.trim();
        // Mild preference: has year, not overly long
        var score = (year != null ? 10 : 0) + Math.max(0, 220 - text.length) / 50;
        return { year: year, text: text, score: score };
      })
      .sort(function (a, b) { return b.score - a.score; });

    // Deduplicate near-identical Wikimedia blurbs (feed sometimes repeats)
    var seenText = {};
    var unique = [];
    scored.forEach(function (p) {
      var key = p.text.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seenText[key]) return;
      seenText[key] = true;
      unique.push(p);
    });

    var picked = unique.slice(0, 3);
    var facts = picked.map(function (p) {
      var text = p.text;
      // Avoid "In 1887: In 1887, …" when the blurb already leads with the year
      var yearLead = p.year != null ? new RegExp('^(in\\s+)?' + p.year + '\\b', 'i') : null;
      if (p.year != null && !yearLead.test(text)) {
        text = 'In ' + p.year + ': ' + text;
      }
      return {
        tag: 'on this day',
        text: text
      };
    });
    return { ok: true, facts: facts };
  }

  function placeNameParts(display) {
    var parts = String(display || '')
      .split(',')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    return {
      city: parts[0] || '',
      region: parts.length >= 2 ? parts[parts.length - 2] : '',
      country: parts.length >= 1 ? parts[parts.length - 1] : '',
      parts: parts
    };
  }

  async function fetchWikiSummary(title) {
    if (!title) return null;
    var url =
      'https://en.wikipedia.org/api/rest_v1/page/summary/' +
      encodeURIComponent(title.replace(/ /g, '_'));
    var res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    var data = await res.json();
    if (!data || data.type === 'disambiguation') return null;
    var extract = (data.extract || '').trim();
    if (extract.length < 40) return null;
    // One friendly sentence-ish clip
    var clip = extract;
    if (clip.length > 220) {
      var cut = clip.lastIndexOf('.', 200);
      clip = (cut > 80 ? clip.slice(0, cut + 1) : clip.slice(0, 200).trim() + '…');
    }
    return {
      title: data.title || title,
      extract: clip,
      url: (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) || null
    };
  }

  async function fetchPlaceFlavor(place, year) {
    var parts = placeNameParts(place.display);
    var candidates = [];
    // US-style: "City, State" (Nominatim: City, County, State, United States)
    var isUS = /united states|usa/i.test(parts.country || '');
    if (isUS && parts.parts.length >= 3) {
      candidates.push(parts.parts[0] + ', ' + parts.parts[parts.length - 2]);
    }
    // Prefer "{city}, {next admin}" style titles when we have them
    if (parts.parts.length >= 2) {
      candidates.push(parts.parts[0] + ', ' + parts.parts[1]);
    }
    if (parts.city) candidates.push(parts.city);
    // Year-in-place pages (often exist for countries / US states)
    if (year && parts.region && !/^united states$/i.test(parts.region)) {
      candidates.push(year + ' in ' + parts.region);
    }
    if (year && parts.country) candidates.push(year + ' in ' + parts.country);

    // Deduplicate
    var seen = {};
    var uniq = [];
    candidates.forEach(function (c) {
      var k = c.toLowerCase();
      if (!seen[k]) {
        seen[k] = true;
        uniq.push(c);
      }
    });

    for (var i = 0; i < uniq.length; i++) {
      try {
        var summary = await fetchWikiSummary(uniq[i]);
        if (!summary) continue;
        var isYearPage = /^\d{4} in /.test(uniq[i]);
        if (isYearPage) {
          return {
            tag: 'place',
            text:
              'Around ' +
              year +
              ' locally: ' +
              summary.extract +
              ' (Wikipedia)'
          };
        }
        return {
          tag: 'place',
          text: 'About ' + summary.title + ': ' + summary.extract + ' (Wikipedia)'
        };
      } catch (e) {
        /* try next */
      }
    }
    return null;
  }

  function clearSpecialFacts() {
    if (factsListEl) factsListEl.innerHTML = '';
    if (factsNoteEl) {
      factsNoteEl.hidden = true;
      factsNoteEl.innerHTML = '';
    }
    if (factsLoadingEl) factsLoadingEl.hidden = true;
  }

  function renderSpecialFacts(items, options) {
    options = options || {};
    factsListEl.innerHTML = items
      .map(function (f) {
        var tagClass = 'fact-tag';
        if (f.tag === 'on this day') tagClass += ' fact-tag-history';
        else if (f.tag === 'place') tagClass += ' fact-tag-place';
        return (
          '<li><span class="' +
          tagClass +
          '">' +
          escapeHtml(f.tag) +
          '</span><span class="fact-body">' +
          escapeHtml(f.text) +
          '</span></li>'
        );
      })
      .join('');

    var notes = [];
    if (options.historyOk && options.historyCount > 0) {
      notes.push(
        'History items are “same calendar day across years,” not necessarily your birth year. Source: Wikipedia / Wikimedia.'
      );
    } else if (options.historyFailed) {
      notes.push('History lookup unavailable right now — sky facts above are still from Astronomy Engine in your browser.');
    } else if (options.historyOk && options.historyCount === 0) {
      notes.push('No on-this-day highlights turned up for that date; sky facts are still local calculations.');
    }
    if (notes.length) {
      factsNoteEl.hidden = false;
      factsNoteEl.textContent = notes.join(' ');
    } else {
      factsNoteEl.hidden = true;
      factsNoteEl.textContent = '';
    }
  }

  async function populateSpecialFacts(when, lat, lon, place, dateStr) {
    clearSpecialFacts();
    if (factsLoadingEl) factsLoadingEl.hidden = false;

    var astro = computeAstronomyFacts(when, lat, lon);
    var parts = dateStr.split('-').map(Number);
    var year = parts[0];
    var month = parts[1];
    var day = parts[2];

    var history = { ok: false, facts: [] };
    try {
      history = await fetchOnThisDay(month, day);
    } catch (e) {
      history = { ok: false, facts: [] };
    }

    var placeFact = null;
    try {
      placeFact = await fetchPlaceFlavor(place, year);
    } catch (e2) {
      placeFact = null;
    }

    var all = astro.concat(history.facts || []);
    if (placeFact) all.push(placeFact);

    if (factsLoadingEl) factsLoadingEl.hidden = true;
    renderSpecialFacts(all, {
      historyOk: !!history.ok,
      historyFailed: !history.ok,
      historyCount: (history.facts || []).length
    });
  }

  function showPlacePicker(places) {
    pendingPlaces = places;
    selectedPlace = null;
    var html =
      '<p class="place-results-label">Multiple matches — pick one:</p><ul class="place-list">';
    places.forEach(function (p, idx) {
      html +=
        '<li><button type="button" data-idx="' +
        idx +
        '">' +
        escapeHtml(p.display) +
        '</button></li>';
    });
    html += '</ul>';
    placeResults.innerHTML = html;
    placeResults.hidden = false;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function runWithPlace(place) {
    clearError();
    setLoading(true);
    results.hidden = true;
    hidePlacePicker();

    try {
      var dateStr = dateInput.value;
      if (!dateStr) throw new Error('Please enter a birth date.');

      var tzInfo = lookupTimezone(place.lat, place.lon);
      var built = buildWhen(dateStr, timeInput.value || '', tzInfo);
      var placements = computeNatal(built.when);

      resultsMeta.innerHTML =
        '<strong>' +
        escapeHtml(place.display) +
        '</strong><br>' +
        escapeHtml(built.localLabel) +
        ' · ' +
        escapeHtml(tzInfo.label) +
        '<br>' +
        place.lat.toFixed(4) +
        '°, ' +
        place.lon.toFixed(4) +
        '° · UTC ' +
        built.when.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');

      results.hidden = false;
      clearSpecialFacts();
      // Defer sky render so the container has layout size
      requestAnimationFrame(function () {
        try {
          renderSky(place.lat, place.lon, built.when);
          renderNatalChart(placements);
          setLoading(false);
          // Facts may hit the network; keep sky/chart visible while they load
          populateSpecialFacts(built.when, place.lat, place.lon, place, dateStr).catch(function () {
            if (factsLoadingEl) factsLoadingEl.hidden = true;
            renderSpecialFacts(computeAstronomyFacts(built.when, place.lat, place.lon), {
              historyOk: false,
              historyFailed: true,
              historyCount: 0
            });
          });
        } catch (err) {
          setLoading(false);
          showError(err.message || String(err));
        }
      });
    } catch (err) {
      setLoading(false);
      showError(err.message || String(err));
    }
  }

  placeResults.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-idx]');
    if (!btn || !pendingPlaces) return;
    var idx = +btn.getAttribute('data-idx');
    selectedPlace = pendingPlaces[idx];
    placeInput.value = selectedPlace.display.split(',').slice(0, 3).join(',');
    runWithPlace(selectedPlace);
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearError();
    selectedPlace = null;

    var dateStr = dateInput.value;
    var place = (placeInput.value || '').trim();
    if (!dateStr) {
      showError('Birth date is required.');
      dateInput.focus();
      return;
    }
    if (!place) {
      showError('Place of birth is required.');
      placeInput.focus();
      return;
    }

    setLoading(true);
    results.hidden = true;
    hidePlacePicker();

    try {
      var places = await geocodePlace(place);
      if (places.length === 1) {
        await runWithPlace(places[0]);
      } else {
        setLoading(false);
        showPlacePicker(places);
      }
    } catch (err) {
      setLoading(false);
      showError(err.message || String(err));
    }
  });

  resetBtn.addEventListener('click', function () {
    form.reset();
    clearError();
    hidePlacePicker();
    results.hidden = true;
    setLoading(false);
    destroyPlanetarium();
    natalEl.innerHTML = '';
    planetListEl.innerHTML = '';
    clearSpecialFacts();
    selectedPlace = null;
  });

  // Soft default example hint via placeholder only — no auto-run
})();
