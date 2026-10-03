/**
 * Birth Sky — client-only curiosity tool for Evil0ctopus.
 * Geocode: Nominatim. Timezone: tz-lookup. Sky: VirtualSky. Wheel/facts: Astronomy Engine.
 * History / births / place snippets: Wikimedia / Wikipedia (best-effort; never invented).
 * Cultural calendars: local Wheel of the Year + Chinese zodiac year math.
 */
(function () {
  'use strict';

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
  var planetDepthEl = document.getElementById('planet-depth');
  var factsListEl = document.getElementById('special-facts-list');
  var moreFactsEl = document.getElementById('more-facts');
  var moreFactsListEl = document.getElementById('more-facts-list');
  var factsLoadingEl = document.getElementById('special-facts-loading');
  var factsNoteEl = document.getElementById('special-facts-note');
  var heroDateEl = document.getElementById('hero-heading');
  var heroPlaceEl = document.getElementById('hero-place');
  var heroFactEl = document.getElementById('hero-fact');
  var shareCardBtn = document.getElementById('share-card-btn');
  var shareCardStatus = document.getElementById('share-card-status');
  var famousBirthsSection = document.getElementById('famous-births');
  var famousBirthsList = document.getElementById('famous-births-list');
  var famousBirthsLoading = document.getElementById('famous-births-loading');
  var famousBirthsNote = document.getElementById('famous-births-note');
  var topSongsSection = document.getElementById('top-songs');
  var topSongsMeta = document.getElementById('top-songs-meta');
  var topSongsLoading = document.getElementById('top-songs-loading');
  var topSongsList = document.getElementById('top-songs-list');
  var topSongsStatus = document.getElementById('top-songs-status');
  var topSongsOfficialLink = document.getElementById('top-songs-official-link');
  var traditionsSection = document.getElementById('traditions');
  var paganBodyEl = document.getElementById('pagan-body');
  var chineseBodyEl = document.getElementById('chinese-body');

  var planetarium = null;
  var pendingPlaces = null;
  var selectedPlace = null;
  var billboardDatesPromise = null;
  var topSongsRequestId = 0;
  var BILLBOARD_ARCHIVE_URL = 'https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main';
  /** @type {null|{placeDisplay:string,dateStr:string,localLabel:string,heroFact:string,famousLine:string,when:Date,lat:number,lon:number,placements:Array,skyNotes:Object}} */
  var lastSession = null;
  var brandImg = null;

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

  function formatAzimuth(az) {
    var dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    var idx = Math.round((((az % 360) + 360) % 360) / 45) % 8;
    return Math.round(az) + '° ' + dirs[idx];
  }

  /**
   * Convert a wall-clock local datetime in an IANA timezone to a UTC Date.
   */
  function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
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
    var res = await fetch(url + '&addressdetails=0', {
      headers: { Accept: 'application/json' }
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
      when = new Date(Date.UTC(y, mo - 1, d, hh - tzInfo.fallbackOffsetHours, mm, 0));
    } else {
      when = zonedTimeToUtc(y, mo, d, hh, mm, tzInfo.timeZone);
    }

    return {
      when: when,
      assumedNoon: assumedNoon,
      localLabel: dateStr + ' ' + (assumedNoon ? '12:00 (assumed noon)' : timeStr),
      year: y,
      month: mo,
      day: d
    };
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
    var vec = Astronomy.GeoVector(bodyEnum, when, true);
    var ect = Astronomy.Ecliptic(vec);
    return ect.elon;
  }

  function computeHorizonNote(bodyKey, when, lat, lon) {
    if (typeof Astronomy === 'undefined') return null;
    try {
      var observer = new Astronomy.Observer(lat, lon, 0);
      var equ = Astronomy.Equator(Astronomy.Body[bodyKey], when, observer, true, true);
      var hor = Astronomy.Horizon(when, observer, equ.ra, equ.dec, 'normal');
      return {
        altitude: hor.altitude,
        azimuth: hor.azimuth,
        above: hor.altitude > 0
      };
    } catch (e) {
      return null;
    }
  }

  function computeNatal(when, lat, lon) {
    if (typeof Astronomy === 'undefined') {
      throw new Error('Astronomy Engine failed to load. Check your connection and refresh.');
    }
    return BODIES.map(function (b) {
      var lonEcl = bodyEclipticLongitude(Astronomy.Body[b.body], when);
      var sign = lonToSign(lonEcl);
      var horizon = computeHorizonNote(b.body, when, lat, lon);
      return {
        key: b.key,
        glyph: b.glyph,
        lon: lonEcl,
        sign: sign,
        horizon: horizon
      };
    });
  }

  function depthSentence(p) {
    var signBit = p.sign.name + ' ' + formatDeg(p.sign.degree);
    if (!p.horizon) {
      return p.key + ' was in ' + signBit + ' (ecliptic longitude) at that moment.';
    }
    var h = p.horizon;
    if (h.above) {
      return (
        p.key +
        ' was above the horizon (~' +
        Math.round(h.altitude) +
        '° altitude, az ' +
        formatAzimuth(h.azimuth) +
        '), in ' +
        signBit +
        '.'
      );
    }
    return (
      p.key +
      ' was below the horizon (~' +
      Math.round(h.altitude) +
      '° altitude) at that place and time, in ' +
      signBit +
      '.'
    );
  }

  function renderNatalChart(placements) {
    var size = 360;
    var cx = size / 2;
    var cy = size / 2;
    var rOuter = 168;
    var rInner = 118;
    var rPlanet = 138;

    function lonToAngle(lon) {
      return ((180 - lon) * Math.PI) / 180;
    }

    var rings = '';
    rings += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rOuter + '" fill="#0b0f14" stroke="#22d3ee" stroke-width="2"/>';
    rings += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rInner + '" fill="#121820" stroke="#334155" stroke-width="1.5"/>';
    rings += '<circle cx="' + cx + '" cy="' + cy + '" r="36" fill="#0b0f14" stroke="#243041" stroke-width="1"/>';

    var wedges = '';
    for (var i = 0; i < 12; i++) {
      var a0 = lonToAngle(i * 30);
      var x0o = cx + rOuter * Math.cos(a0);
      var y0o = cy + rOuter * Math.sin(a0);
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
      .map(function (p, idx) {
        return (
          '<li data-idx="' +
          idx +
          '">' +
          '<button type="button" class="pl-row" aria-expanded="false" aria-controls="planet-depth" id="planet-btn-' +
          idx +
          '">' +
          '<span class="pl-name">' +
          p.glyph +
          ' ' +
          p.key +
          '</span><span class="pl-sign">' +
          p.sign.name +
          ' ' +
          formatDeg(p.sign.degree) +
          '</span></button></li>'
        );
      })
      .join('');

    if (planetDepthEl) {
      planetDepthEl.hidden = true;
      planetDepthEl.innerHTML = '';
    }
  }

  function openPlanetDepth(idx) {
    if (!lastSession || !lastSession.placements) return;
    var p = lastSession.placements[idx];
    if (!p || !planetDepthEl) return;

    var items = planetListEl.querySelectorAll('li');
    for (var i = 0; i < items.length; i++) {
      var open = i === idx;
      items[i].classList.toggle('is-open', open);
      var btn = items[i].querySelector('button.pl-row');
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    planetDepthEl.hidden = false;
    planetDepthEl.innerHTML =
      '<span class="planet-depth-label">Sky note · ' +
      escapeHtml(p.key) +
      '</span>' +
      escapeHtml(depthSentence(p));
  }

  var NAKED_EYE = [
    { key: 'Mercury', body: 'Mercury' },
    { key: 'Venus', body: 'Venus' },
    { key: 'Mars', body: 'Mars' },
    { key: 'Jupiter', body: 'Jupiter' },
    { key: 'Saturn', body: 'Saturn' }
  ];

  function moonPhaseName(phaseDeg, fraction) {
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

  function scoreFact(f) {
    // Prefer striking astronomy (moon/planets) as hero; history & place as backups.
    var t = (f.text || '').toLowerCase();
    var score = 0;
    if (f.tag === 'astronomy') score += 40;
    if (f.tag === 'on this day') score += 20;
    if (f.tag === 'place') score += 10;
    if (/full moon|new moon|naked-eye|brightest|illuminated/.test(t)) score += 25;
    if (/none of the classic/.test(t)) score += 5;
    if (/season/.test(t)) score += 8;
    score += Math.max(0, 180 - (f.text || '').length) / 40;
    return score;
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
          '% illuminated — a real glow (or hush) over that night’s sky.',
        heroWeight: pct > 90 || pct < 10 ? 30 : 20
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
            ').',
          heroWeight: 22
        });
      } else {
        facts.push({
          tag: 'astronomy',
          text:
            'None of the classic naked-eye planets (Mercury through Saturn) sat above the horizon at that exact moment — the sky’s guest list was quieter.',
          heroWeight: 12
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
          ' season (an astronomy calendar note — not a horoscope prediction).',
        heroWeight: 10
      });
    } catch (e3) { /* skip sun */ }

    try {
      var season = seasonNote(when, lat);
      if (season) {
        facts.push({ tag: 'astronomy', text: season, heroWeight: 8 });
      }
    } catch (e4) { /* skip season */ }

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

    var scored = items
      .filter(function (it) {
        return it && typeof it.text === 'string' && it.text.trim().length > 20;
      })
      .map(function (it) {
        var year = typeof it.year === 'number' ? it.year : null;
        var text = it.text.trim();
        var score = (year != null ? 10 : 0) + Math.max(0, 220 - text.length) / 50;
        return { year: year, text: text, score: score };
      })
      .sort(function (a, b) { return b.score - a.score; });

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
      var yearLead = p.year != null ? new RegExp('^(in\\s+)?' + p.year + '\\b', 'i') : null;
      if (p.year != null && !yearLead.test(text)) {
        text = 'In ' + p.year + ': ' + text;
      }
      return { tag: 'on this day', text: text };
    });
    return { ok: true, facts: facts };
  }

  async function fetchFamousBirths(month, day) {
    var mm = pad2(month);
    var dd = pad2(day);
    var url =
      'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/births/' + mm + '/' + dd;
    try {
      var res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return { ok: false, people: [] };
      var data = await res.json();
      var list = Array.isArray(data.births) ? data.births : [];
      if (!list.length) return { ok: true, people: [] };

      var scored = list
        .map(function (it) {
          if (!it) return null;
          var text = (it.text || '').trim();
          var pages = Array.isArray(it.pages) ? it.pages : [];
          var page = pages[0] || {};
          var name =
            (page.titles && (page.titles.normalized || page.titles.display)) ||
            page.title ||
            '';
          // Prefer first clause before "was" / em dash from the blurb as name fallback
          if (!name && text) {
            var m = text.match(/^([^,—(]+)/);
            name = m ? m[1].trim() : '';
          }
          if (!name || name.length < 2) return null;

          var year = typeof it.year === 'number' ? it.year : null;
          var why = '';
          if (page.description) {
            why = String(page.description).trim();
          } else if (page.extract) {
            why = String(page.extract).trim();
            var cut = why.indexOf('.');
            if (cut > 20 && cut < 140) why = why.slice(0, cut + 1);
            else if (why.length > 120) why = why.slice(0, 117).trim() + '…';
          } else if (text) {
            // Strip leading "Name, " year-ish lead from onthisday text
            why = text.replace(/^[^,—]+[,—]\s*/, '').trim();
            if (why.length > 120) why = why.slice(0, 117).trim() + '…';
          }

          // Mild curation from API signals only — never invent names
          var score = 0;
          if (year != null) score += 8;
          if (page.description) score += 12;
          if (page.extract) score += Math.min(16, Math.floor(String(page.extract).length / 35));
          if (page.thumbnail) score += 4;
          if (why && why.length > 12) score += 5;
          // Prefer historically settled bios over brand-new living pages when signals tie
          if (year != null) {
            if (year <= 1950) score += 10;
            else if (year <= 1985) score += 6;
            else if (year <= 2000) score += 2;
          }
          // Light boost for description keywords that often mark well-known figures
          var desc = (
            (page.description || '') +
            ' ' +
            (page.extract || '') +
            ' ' +
            text
          ).toLowerCase();
          if (/nobel/.test(desc)) score += 14;
          if (/physicist|composer|painter|author|poet|astronaut|prime minister|president|mathematician|philosopher|activist|laureate/.test(desc)) {
            score += 10;
          }

          return { name: name, year: year, why: why, score: score };
        })
        .filter(Boolean)
        .sort(function (a, b) { return b.score - a.score; });

      var seen = {};
      var unique = [];
      scored.forEach(function (p) {
        var k = p.name.toLowerCase();
        if (seen[k]) return;
        seen[k] = true;
        unique.push(p);
      });

      return { ok: true, people: unique.slice(0, 6) };
    } catch (e) {
      return { ok: false, people: [] };
    }
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
    var clip = extract;
    if (clip.length > 220) {
      var cut = clip.lastIndexOf('.', 200);
      clip = cut > 80 ? clip.slice(0, cut + 1) : clip.slice(0, 200).trim() + '…';
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
    var isUS = /united states|usa/i.test(parts.country || '');
    if (isUS && parts.parts.length >= 3) {
      candidates.push(parts.parts[0] + ', ' + parts.parts[parts.length - 2]);
    }
    if (parts.parts.length >= 2) {
      candidates.push(parts.parts[0] + ', ' + parts.parts[1]);
    }
    if (parts.city) candidates.push(parts.city);
    if (year && parts.region && !/^united states$/i.test(parts.region)) {
      candidates.push(year + ' in ' + parts.region);
    }
    if (year && parts.country) candidates.push(year + ' in ' + parts.country);

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
            text: 'Around ' + year + ' locally: ' + summary.extract + ' (Wikipedia)'
          };
        }
        return {
          tag: 'place',
          text: 'About ' + summary.title + ': ' + summary.extract + ' (Wikipedia)'
        };
      } catch (e) { /* try next */ }
    }
    return null;
  }

  /* —— Cultural calendars —— */

  /** Approximate Chinese New Year (UTC date) for Gregorian years 1900–2100 — compact table via formula + known offsets.
   *  Uses a simple lookup for common range; falls back to Feb 4 (lichun-ish) outside table.
   *  Accurate enough for year-animal assignment; not a full lunar converter.
   */
  var CNY_MD = {
    // month*100+day for Chinese New Year (Gregorian), selected span; missing years use Feb 4 fallback
    1960: 128, 1961: 215, 1962: 205, 1963: 125, 1964: 213, 1965: 202, 1966: 121, 1967: 209,
    1968: 130, 1969: 217, 1970: 206, 1971: 127, 1972: 215, 1973: 203, 1974: 123, 1975: 211,
    1976: 131, 1977: 218, 1978: 207, 1979: 128, 1980: 216, 1981: 205, 1982: 125, 1983: 213,
    1984: 202, 1985: 220, 1986: 209, 1987: 129, 1988: 217, 1989: 206, 1990: 127, 1991: 215,
    1992: 204, 1993: 123, 1994: 210, 1995: 131, 1996: 219, 1997: 207, 1998: 128, 1999: 216,
    2000: 205, 2001: 124, 2002: 212, 2003: 201, 2004: 122, 2005: 209, 2006: 129, 2007: 218,
    2008: 207, 2009: 126, 2010: 214, 2011: 203, 2012: 123, 2013: 210, 2014: 131, 2015: 219,
    2016: 208, 2017: 128, 2018: 216, 2019: 205, 2020: 125, 2021: 212, 2022: 201, 2023: 122,
    2024: 210, 2025: 129, 2026: 217, 2027: 206, 2028: 126, 2029: 213, 2030: 203
  };

  function chineseNewYearCutoff(year) {
    var md = CNY_MD[year];
    if (!md) return { month: 2, day: 4 }; // approximate
    return { month: Math.floor(md / 100), day: md % 100 };
  }

  function chineseZodiacForDate(year, month, day) {
    var animals = [
      'Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake',
      'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'
    ];
    var elements = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
    var cny = chineseNewYearCutoff(year);
    var zodiacYear = year;
    if (month < cny.month || (month === cny.month && day < cny.day)) {
      zodiacYear = year - 1;
    }
    // 1984 = Wood Rat (甲子). Animal: (year - 4) % 12 → Rat at 0
    var animal = animals[((zodiacYear - 4) % 12 + 12) % 12];
    // Heavenly stem cycle: (year - 4) % 10 → element index floor(/2)
    var stem = ((zodiacYear - 4) % 10 + 10) % 10;
    var element = elements[Math.floor(stem / 2)];
    var yinYang = stem % 2 === 0 ? 'yang' : 'yin';
    return {
      zodiacYear: zodiacYear,
      animal: animal,
      element: element,
      yinYang: yinYang,
      approxCny: !CNY_MD[year]
    };
  }

  function dayOfYear(year, month, day) {
    var d = new Date(Date.UTC(year, month - 1, day));
    var start = new Date(Date.UTC(year, 0, 1));
    return Math.round((d - start) / 86400000) + 1;
  }

  function computePaganNote(year, month, day, when) {
    // Traditional fixed dates + astronomical solstice/equinox when available
    var markers = [
      { name: 'Imbolc', month: 2, day: 1, note: 'early spring / lambing-season marker in many modern Wheel of the Year calendars.' },
      { name: 'Ostara', month: 3, day: 20, note: 'spring equinox season — balance of day and night.' },
      { name: 'Beltane', month: 5, day: 1, note: 'late-spring fire festival in many neo-pagan calendars.' },
      { name: 'Litha', month: 6, day: 21, note: 'summer solstice season — longest daylight in the north.' },
      { name: 'Lughnasadh', month: 8, day: 1, note: 'early harvest / first fruits marker.' },
      { name: 'Mabon', month: 9, day: 21, note: 'autumn equinox season — second harvest marker for many.' },
      { name: 'Samhain', month: 10, day: 31, note: 'year-turn / thin-veil seasonal marker for many modern practitioners.' },
      { name: 'Yule', month: 12, day: 21, note: 'winter solstice season — longest night in the north.' }
    ];

    try {
      if (typeof Astronomy !== 'undefined' && Astronomy.Seasons) {
        var seasons = Astronomy.Seasons(year);
        function setFromAstro(name, astroTime) {
          if (!astroTime || !astroTime.date) return;
          var d = astroTime.date;
          for (var i = 0; i < markers.length; i++) {
            if (markers[i].name === name) {
              markers[i].month = d.getUTCMonth() + 1;
              markers[i].day = d.getUTCDate();
              markers[i].astro = true;
            }
          }
        }
        setFromAstro('Ostara', seasons.mar_equinox);
        setFromAstro('Litha', seasons.jun_solstice);
        setFromAstro('Mabon', seasons.sep_equinox);
        setFromAstro('Yule', seasons.dec_solstice);
      }
    } catch (e) { /* keep fixed dates */ }

    var birthDoy = dayOfYear(year, month, day);
    var best = null;
    markers.forEach(function (m) {
      var mdoy = dayOfYear(year, m.month, m.day);
      var delta = Math.abs(birthDoy - mdoy);
      var wrap = 365 - delta; // ignore leap nuance for distance display
      var dist = Math.min(delta, wrap);
      // Prefer same-year closer; for wrap across year boundary use wrap distance
      var signed;
      if (delta <= wrap) signed = birthDoy - mdoy;
      else signed = birthDoy < mdoy ? -(wrap) : wrap;

      if (!best || dist < best.dist) {
        best = { marker: m, dist: dist, signed: signed, mdoy: mdoy };
      }
    });

    if (!best) {
      return 'Wheel of the Year markers could not be computed for this date.';
    }

    var m = best.marker;
    var relation;
    if (best.dist === 0) {
      relation = 'falls on <strong>' + m.name + '</strong>';
    } else if (best.signed < 0) {
      relation =
        'nearest sabbat: <strong>' +
        m.name +
        '</strong>, ' +
        best.dist +
        ' day' +
        (best.dist === 1 ? '' : 's') +
        ' later';
    } else {
      relation =
        'nearest sabbat: <strong>' +
        m.name +
        '</strong>, ' +
        best.dist +
        ' day' +
        (best.dist === 1 ? '' : 's') +
        ' earlier';
    }

    return (
      relation +
      ' (~' +
      pad2(m.month) +
      '/' +
      pad2(m.day) +
      (m.astro ? ', astronomical season time' : ', traditional date') +
      '). ' +
      m.note +
      ' Labeled as a modern neo-pagan / Wiccan-leaning seasonal calendar — not a claim about your beliefs.'
    );
  }

  function computeChineseNote(year, month, day) {
    var z = chineseZodiacForDate(year, month, day);
    return (
      'For the Chinese zodiac year that includes this date: <strong>' +
      z.element +
      ' ' +
      z.animal +
      '</strong> (' +
      z.yinYang +
      ', zodiac year ' +
      z.zodiacYear +
      '). ' +
      'Exact lunar month/day and festival dates need a full lunar calendar conversion — this tool only maps the Gregorian date to the year animal and element' +
      (z.approxCny
        ? ' (Chinese New Year cutoff approximated as early February for this year).'
        : ' (using a known Chinese New Year date for the year cutoff).')
    );
  }

  function renderTraditions(year, month, day, when) {
    if (!traditionsSection) return;
    traditionsSection.hidden = false;
    if (paganBodyEl) paganBodyEl.innerHTML = computePaganNote(year, month, day, when);
    if (chineseBodyEl) chineseBodyEl.innerHTML = computeChineseNote(year, month, day);
  }

  function clearSpecialFacts() {
    if (factsListEl) factsListEl.innerHTML = '';
    if (moreFactsListEl) moreFactsListEl.innerHTML = '';
    if (moreFactsEl) {
      moreFactsEl.hidden = true;
      moreFactsEl.open = false;
    }
    if (factsNoteEl) {
      factsNoteEl.hidden = true;
      factsNoteEl.innerHTML = '';
    }
    if (factsLoadingEl) factsLoadingEl.hidden = true;
  }

  function clearFamousBirths() {
    if (famousBirthsList) famousBirthsList.innerHTML = '';
    if (famousBirthsNote) {
      famousBirthsNote.hidden = true;
      famousBirthsNote.textContent = '';
    }
    if (famousBirthsLoading) famousBirthsLoading.hidden = true;
    if (famousBirthsSection) famousBirthsSection.hidden = true;
  }

  function clearTopSongs() {
    topSongsRequestId++;
    if (topSongsSection) topSongsSection.hidden = true;
    if (topSongsMeta) topSongsMeta.textContent = '';
    if (topSongsLoading) topSongsLoading.hidden = true;
    if (topSongsList) {
      topSongsList.innerHTML = '';
      topSongsList.hidden = true;
    }
    if (topSongsStatus) {
      topSongsStatus.hidden = true;
      topSongsStatus.textContent = '';
    }
    if (topSongsOfficialLink) {
      topSongsOfficialLink.href = 'https://www.billboard.com/charts/hot-100/';
    }
  }

  function clearTraditions() {
    if (traditionsSection) traditionsSection.hidden = true;
    if (paganBodyEl) paganBodyEl.innerHTML = '';
    if (chineseBodyEl) chineseBodyEl.innerHTML = '';
  }

  function factLiHtml(f, isHero) {
    var tagClass = 'fact-tag';
    if (f.tag === 'on this day') tagClass += ' fact-tag-history';
    else if (f.tag === 'place') tagClass += ' fact-tag-place';
    return (
      '<li' +
      (isHero ? ' class="is-hero"' : '') +
      '><span class="' +
      tagClass +
      '">' +
      escapeHtml(f.tag) +
      '</span><span class="fact-body">' +
      escapeHtml(f.text) +
      '</span></li>'
    );
  }

  function renderSpecialFacts(items, options) {
    options = options || {};
    var ranked = (items || []).slice().sort(function (a, b) {
      return scoreFact(b) - scoreFact(a);
    });

    var hero = ranked[0] || null;
    var backups = ranked.slice(1, 3);
    var rest = ranked.slice(3);

    var visible = [];
    if (hero) visible.push(hero);
    backups.forEach(function (b) { visible.push(b); });

    factsListEl.innerHTML = visible
      .map(function (f, i) {
        return factLiHtml(f, i === 0);
      })
      .join('');

    if (rest.length && moreFactsEl && moreFactsListEl) {
      moreFactsListEl.innerHTML = rest.map(function (f) { return factLiHtml(f, false); }).join('');
      moreFactsEl.hidden = false;
    } else if (moreFactsEl) {
      moreFactsEl.hidden = true;
      moreFactsEl.open = false;
      if (moreFactsListEl) moreFactsListEl.innerHTML = '';
    }

    // Update hero fact line if we have astronomy
    if (heroFactEl && hero) {
      heroFactEl.textContent = hero.text;
      if (lastSession) lastSession.heroFact = hero.text;
    }

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

    return hero;
  }

  function renderFamousBirths(result) {
    if (!famousBirthsSection) return;
    famousBirthsSection.hidden = false;
    if (famousBirthsLoading) famousBirthsLoading.hidden = true;

    if (!result.ok) {
      famousBirthsList.innerHTML = '';
      famousBirthsNote.hidden = false;
      famousBirthsNote.textContent =
        'Shared-birthday lookup unavailable right now. Try again later — we never invent names.';
      if (lastSession) lastSession.famousLine = '';
      return;
    }

    if (!result.people.length) {
      famousBirthsList.innerHTML =
        '<li class="births-empty" style="grid-column:1/-1;list-style:none;border-style:dashed">No birth entries turned up for that calendar date in the Wikimedia feed.</li>';
      famousBirthsNote.hidden = false;
      famousBirthsNote.textContent = 'Source: Wikipedia / Wikimedia on-this-day births (month/day only).';
      if (lastSession) lastSession.famousLine = '';
      return;
    }

    famousBirthsList.innerHTML = result.people
      .map(function (p) {
        return (
          '<li><span class="birth-name">' +
          escapeHtml(p.name) +
          (p.year != null
            ? ' <span class="birth-year">(' + p.year + ')</span>'
            : '') +
          '</span>' +
          (p.why ? '<span class="birth-why">' + escapeHtml(p.why) + '</span>' : '') +
          '</li>'
        );
      })
      .join('');

    famousBirthsNote.hidden = false;
    famousBirthsNote.textContent =
      'Shared calendar birthdays (month/day), any year. Source: Wikipedia / Wikimedia.';

    var top = result.people[0];
    if (lastSession) {
      lastSession.famousLine =
        top.name + (top.year != null ? ' (' + top.year + ')' : '') + ' also shares this calendar birthday';
    }
  }

  function formatHeroDate(dateStr) {
    var parts = dateStr.split('-').map(Number);
    try {
      var d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function shortPlace(display) {
    var parts = String(display || '')
      .split(',')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    return parts.slice(0, 3).join(', ') || display;
  }

  function renderHero(place, dateStr, localLabel, heroText) {
    if (heroDateEl) heroDateEl.textContent = formatHeroDate(dateStr);
    if (heroPlaceEl) {
      heroPlaceEl.textContent = shortPlace(place.display) + ' · ' + localLabel;
    }
    if (heroFactEl) {
      heroFactEl.textContent =
        heroText || 'Gathering a striking sky note for this moment…';
    }
  }

  async function populateSpecialFacts(when, lat, lon, place, dateStr) {
    clearSpecialFacts();
    if (factsLoadingEl) factsLoadingEl.hidden = false;

    var astro = computeAstronomyFacts(when, lat, lon);
    // Seed hero immediately from local astronomy
    var earlyHero = astro.slice().sort(function (a, b) {
      return scoreFact(b) - scoreFact(a);
    })[0];
    if (earlyHero && heroFactEl) {
      heroFactEl.textContent = earlyHero.text;
      if (lastSession) lastSession.heroFact = earlyHero.text;
    }

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

  async function populateFamousBirths(month, day) {
    clearFamousBirths();
    if (famousBirthsSection) famousBirthsSection.hidden = false;
    if (famousBirthsLoading) famousBirthsLoading.hidden = false;
    var result = await fetchFamousBirths(month, day);
    renderFamousBirths(result);
  }

  async function findBillboardChartDate(birthDate) {
    if (!billboardDatesPromise) {
      billboardDatesPromise = fetch(BILLBOARD_ARCHIVE_URL + '/valid_dates.json', {
        cache: 'force-cache'
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Chart dates unavailable (' + res.status + ').');
          return res.json();
        })
        .then(function (dates) {
          if (!Array.isArray(dates)) throw new Error('Chart date archive is invalid.');
          return dates;
        })
        .catch(function (error) {
          billboardDatesPromise = null;
          throw error;
        });
    }

    var dates = await billboardDatesPromise;
    var chartDate = null;
    for (var i = 0; i < dates.length; i++) {
      if (dates[i] >= birthDate) {
        chartDate = dates[i];
        break;
      }
    }
    if (!chartDate) return null;

    var birthParts = birthDate.split('-').map(Number);
    var chartParts = chartDate.split('-').map(Number);
    var dayDelta = Math.round(
      (Date.UTC(chartParts[0], chartParts[1] - 1, chartParts[2]) -
        Date.UTC(birthParts[0], birthParts[1] - 1, birthParts[2])) /
        86400000
    );
    return dayDelta >= 0 && dayDelta <= 6 ? chartDate : null;
  }

  async function populateTopSongs(birthDate) {
    if (!topSongsSection) return;

    var requestId = ++topSongsRequestId;
    topSongsSection.hidden = false;
    topSongsLoading.hidden = false;
    topSongsList.hidden = true;
    topSongsList.innerHTML = '';
    topSongsStatus.hidden = true;
    topSongsStatus.textContent = '';
    topSongsMeta.textContent = 'Chart week containing ' + formatHeroDate(birthDate) + '.';

    function showUnavailable(message) {
      if (requestId !== topSongsRequestId) return;
      topSongsLoading.hidden = true;
      topSongsList.hidden = true;
      topSongsStatus.hidden = false;
      topSongsStatus.textContent = message;
    }

    try {
      var chartDate = await findBillboardChartDate(birthDate);
      if (requestId !== topSongsRequestId) return;
      if (!chartDate) {
        showUnavailable('No archived U.S. Hot 100 chart was found for that birthday week.');
        return;
      }

      var response = await fetch(
        BILLBOARD_ARCHIVE_URL + '/date/' + chartDate + '.json',
        { cache: 'force-cache' }
      );
      if (!response.ok) throw new Error('Chart unavailable (' + response.status + ').');
      var chart = await response.json();
      if (requestId !== topSongsRequestId) return;
      if (!chart || chart.date !== chartDate || !Array.isArray(chart.data)) {
        throw new Error('Chart response is invalid.');
      }

      var songs = chart.data
        .filter(function (song) {
          return song && typeof song.song === 'string' && typeof song.artist === 'string';
        })
        .sort(function (a, b) {
          return Number(a.this_week) - Number(b.this_week);
        })
        .slice(0, 5);
      if (songs.length < 5) throw new Error('Chart does not contain five ranked songs.');

      topSongsMeta.textContent =
        'Chart week containing ' +
        formatHeroDate(birthDate) +
        ' · chart dated ' +
        formatHeroDate(chartDate) +
        '.';
      topSongsOfficialLink.href =
        'https://www.billboard.com/charts/hot-100/' + chartDate + '/';
      topSongsList.innerHTML = songs
        .map(function (song) {
          return (
            '<li><span class="song-rank">' +
            ('0' + escapeHtml(song.this_week)).slice(-2) +
            '</span><span class="song-main"><span class="song-title">' +
            escapeHtml(song.song) +
            '</span><span class="song-artist">' +
            escapeHtml(song.artist) +
            '</span></span></li>'
          );
        })
        .join('');
      topSongsLoading.hidden = true;
      topSongsList.hidden = false;
    } catch (error) {
      showUnavailable('The chart archive could not be reached. Try again later.');
    }
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

  function ensureBrandImage() {
    if (brandImg && brandImg.complete) return Promise.resolve(brandImg);
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        brandImg = img;
        resolve(img);
      };
      img.onerror = function () {
        brandImg = null;
        resolve(null);
      };
      img.src = 'assets/brand-mark.jpg';
    });
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var words = String(text || '').split(/\s+/);
    var line = '';
    var lines = [];
    for (var n = 0; n < words.length; n++) {
      var test = line ? line + ' ' + words[n] : words[n];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[n];
        if (lines.length >= maxLines - 1) {
          // rest on last line with ellipsis if needed
          var rest = [words[n]].concat(words.slice(n + 1)).join(' ');
          while (ctx.measureText(rest + '…').width > maxWidth && rest.length > 3) {
            rest = rest.slice(0, -1);
          }
          lines.push(rest.length < String(text).length ? rest + '…' : rest);
          return lines;
        }
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  async function saveShareCard() {
    if (!lastSession) {
      if (shareCardStatus) {
        shareCardStatus.hidden = false;
        shareCardStatus.textContent = 'Generate a Birth Sky first.';
      }
      return;
    }
    if (shareCardStatus) {
      shareCardStatus.hidden = false;
      shareCardStatus.textContent = 'Drawing card…';
    }

    var img = await ensureBrandImage();
    var w = 1080;
    var h = 1350;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, w, h);
    var grad = ctx.createRadialGradient(w * 0.85, 0, 40, w * 0.7, h * 0.2, w * 0.9);
    grad.addColorStop(0, 'rgba(34,211,238,0.22)');
    grad.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Top accent bar
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(0, 0, w, 8);

    // Brand
    var brandY = 56;
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(72, brandY + 20, 28, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 44, brandY - 8, 56, 56);
      ctx.restore();
    }
    ctx.fillStyle = '#e8eef6';
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.fillText('Evil0ctopus', img ? 112 : 56, brandY + 30);
    ctx.fillStyle = '#22d3ee';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText('BIRTH SKY', img ? 112 : 56, brandY + 54);

    // Date
    var y = 200;
    ctx.fillStyle = '#e8eef6';
    ctx.font = '700 48px system-ui, sans-serif';
    var dateLines = wrapText(ctx, formatHeroDate(lastSession.dateStr), 56, y, w - 112, 56, 2);
    dateLines.forEach(function (ln, i) {
      ctx.fillText(ln, 56, y + i * 56);
    });
    y += dateLines.length * 56 + 28;

    // Place
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 28px system-ui, sans-serif';
    var placeLines = wrapText(ctx, shortPlace(lastSession.placeDisplay), 56, y, w - 112, 36, 3);
    placeLines.forEach(function (ln, i) {
      ctx.fillText(ln, 56, y + i * 36);
    });
    y += placeLines.length * 36 + 40;

    // Hero fact box
    var boxTop = y;
    ctx.fillStyle = '#121820';
    ctx.strokeStyle = 'rgba(34,211,238,0.45)';
    ctx.lineWidth = 2;
    var factPad = 36;
    ctx.font = '400 30px system-ui, sans-serif';
    var factLines = wrapText(ctx, lastSession.heroFact || '', 56 + factPad, 0, w - 112 - factPad * 2, 40, 7);
    var boxH = factPad * 2 + factLines.length * 40 + 24;
    roundRect(ctx, 56, boxTop, w - 112, boxH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#22d3ee';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText('SKY NOTE', 56 + factPad, boxTop + 32);
    ctx.fillStyle = '#e8eef6';
    ctx.font = '400 30px system-ui, sans-serif';
    factLines.forEach(function (ln, i) {
      ctx.fillText(ln, 56 + factPad, boxTop + 68 + i * 40);
    });
    y = boxTop + boxH + 36;

    // Famous birthday line
    if (lastSession.famousLine) {
      ctx.fillStyle = '#fde68a';
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText('SHARED CALENDAR BIRTHDAY', 56, y);
      y += 32;
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '400 26px system-ui, sans-serif';
      var fameLines = wrapText(ctx, lastSession.famousLine, 56, y, w - 112, 34, 3);
      fameLines.forEach(function (ln, i) {
        ctx.fillText(ln, 56, y + i * 34);
      });
      y += fameLines.length * 34 + 24;
    }

    // Footer
    ctx.fillStyle = '#64748b';
    ctx.font = '400 20px system-ui, sans-serif';
    ctx.fillText('Curiosity tool · not destiny · not a prediction', 56, h - 56);
    ctx.fillStyle = '#475569';
    ctx.font = '400 18px system-ui, sans-serif';
    ctx.fillText('evil0ctopus · Birth Sky', 56, h - 28);

    try {
      var url = canvas.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download =
        'evil0ctopus-birth-sky-' +
        lastSession.dateStr +
        '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (shareCardStatus) {
        shareCardStatus.hidden = false;
        shareCardStatus.textContent = 'Share card downloaded.';
      }
    } catch (err) {
      if (shareCardStatus) {
        shareCardStatus.hidden = false;
        shareCardStatus.textContent = 'Could not save the image in this browser.';
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function runWithPlace(place) {
    clearError();
    setLoading(true);
    results.hidden = true;
    hidePlacePicker();
    clearFamousBirths();
    clearTraditions();
    clearSpecialFacts();
    clearTopSongs();

    try {
      var dateStr = dateInput.value;
      if (!dateStr) throw new Error('Please enter a birth date.');

      var tzInfo = lookupTimezone(place.lat, place.lon);
      var built = buildWhen(dateStr, timeInput.value || '', tzInfo);
      var placements = computeNatal(built.when, place.lat, place.lon);

      lastSession = {
        placeDisplay: place.display,
        dateStr: dateStr,
        localLabel: built.localLabel,
        heroFact: '',
        famousLine: '',
        when: built.when,
        lat: place.lat,
        lon: place.lon,
        placements: placements
      };

      renderHero(place, dateStr, built.localLabel, '');

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
      renderTraditions(built.year, built.month, built.day, built.when);

      requestAnimationFrame(function () {
        try {
          renderSky(place.lat, place.lon, built.when);
          renderNatalChart(placements);
          setLoading(false);

          populateSpecialFacts(built.when, place.lat, place.lon, place, dateStr).catch(function () {
            if (factsLoadingEl) factsLoadingEl.hidden = true;
            renderSpecialFacts(computeAstronomyFacts(built.when, place.lat, place.lon), {
              historyOk: false,
              historyFailed: true,
              historyCount: 0
            });
          });

          populateFamousBirths(built.month, built.day).catch(function () {
            renderFamousBirths({ ok: false, people: [] });
          });
          populateTopSongs(dateStr);
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

  if (planetListEl) {
    planetListEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button.pl-row');
      if (!btn) return;
      var li = btn.closest('li[data-idx]');
      if (!li) return;
      var idx = +li.getAttribute('data-idx');
      if (btn.getAttribute('aria-expanded') === 'true') {
        btn.setAttribute('aria-expanded', 'false');
        li.classList.remove('is-open');
        if (planetDepthEl) {
          planetDepthEl.hidden = true;
          planetDepthEl.innerHTML = '';
        }
        return;
      }
      openPlanetDepth(idx);
    });
  }

  if (shareCardBtn) {
    shareCardBtn.addEventListener('click', function () {
      saveShareCard();
    });
  }

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
    if (planetDepthEl) {
      planetDepthEl.hidden = true;
      planetDepthEl.innerHTML = '';
    }
    clearSpecialFacts();
    clearFamousBirths();
    clearTopSongs();
    clearTraditions();
    lastSession = null;
    selectedPlace = null;
    if (shareCardStatus) {
      shareCardStatus.hidden = true;
      shareCardStatus.textContent = '';
    }
  });

  // Soft default example hint via placeholder only — no auto-run
})();
