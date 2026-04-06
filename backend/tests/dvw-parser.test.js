// ===========================================
// LVC Media Hub -- DVW Parser Tests
// Testar dvwParserService.parseFile med mockad filsystemlasning
// ===========================================
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  readFile: vi.fn()
}));

import { readFile } from 'fs/promises';
import { dvwParserService } from '../src/services/dvwParser.js';

// ----- Helper: bygger DVW-filinnehall -----
function createDvwContent(options = {}) {
  const {
    homeTeam = 'Linkoeping VC',
    awayTeam = 'Hylte/Halmstad',
    homePlayers = [
      { number: 16, firstName: 'Melker', lastName: 'Nordin' },
      { number: 7, firstName: 'Erik', lastName: 'Svensson' }
    ],
    awayPlayers = [
      { number: 3, firstName: 'Johan', lastName: 'Karlsson' },
      { number: 9, firstName: 'Axel', lastName: 'Berg' }
    ],
    matchTime = '18.30.00',
    scoutLines = [],
    extraSections = ''
  } = options;

  // Player line: index 1=number, index 9=lastName, index 10=firstName (11+ parts)
  const playerLine = (p) => {
    const parts = new Array(12).fill('');
    parts[1] = String(p.number);
    parts[9] = p.lastName;
    parts[10] = p.firstName;
    return parts.join(';');
  };

  const lines = [];
  lines.push('[3TEAMS]');
  // parseTeams reads parts[1] -- format: ;TeamName;...
  lines.push(';' + homeTeam + ';;;;;');
  lines.push(';' + awayTeam + ';;;;;');

  lines.push('[3PLAYERS-H]');
  for (const p of homePlayers) {
    lines.push(playerLine(p));
  }

  lines.push('[3PLAYERS-V]');
  for (const p of awayPlayers) {
    lines.push(playerLine(p));
  }

  lines.push('[3MATCH]');
  lines.push(';' + matchTime + ';');

  lines.push('[3SCOUT]');
  for (const s of scoutLines) {
    lines.push(s);
  }

  if (extraSections) {
    lines.push(extraSections);
  }

  return lines.join('\n');
}

// ----- Setup -----
beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================
// 1. Team parsing
// ===========================================
describe('dvwParserService.parseFile -- teams', () => {
  it('ska parsa hemmalag och bortalag korrekt', async () => {
    const content = createDvwContent({
      homeTeam: 'LVC Linkoeping',
      awayTeam: 'Falkenberg VBK'
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.teams.H).toBe('LVC Linkoeping');
    expect(result.teams.V).toBe('Falkenberg VBK');
  });

  it('ska hantera lag med specialtecken', async () => {
    const content = createDvwContent({
      homeTeam: 'Hylte/Halmstad VBK',
      awayTeam: 'Oerkelljunga VK'
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.teams.H).toBe('Hylte/Halmstad VBK');
    expect(result.teams.V).toBe('Oerkelljunga VK');
  });
});

// ===========================================
// 2. Player parsing
// ===========================================
describe('dvwParserService.parseFile -- players', () => {
  it('ska parsa spelare med nummer, namn och lag', async () => {
    const content = createDvwContent({
      homePlayers: [
        { number: 16, firstName: 'Melker', lastName: 'Nordin' },
        { number: 7, firstName: 'Erik', lastName: 'Svensson' }
      ],
      awayPlayers: [
        { number: 3, firstName: 'Johan', lastName: 'Karlsson' }
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.players).toHaveLength(3);

    const melker = result.players.find(p => p.number === 16);
    expect(melker).toBeDefined();
    expect(melker.name).toBe('Melker Nordin');
    expect(melker.team).toBe('H');

    const johan = result.players.find(p => p.number === 3);
    expect(johan).toBeDefined();
    expect(johan.name).toBe('Johan Karlsson');
    expect(johan.team).toBe('V');
  });

  it('ska hantera spelare med bara efternamn', async () => {
    const content = createDvwContent({
      homePlayers: [
        { number: 5, firstName: '', lastName: 'Andersson' }
      ],
      awayPlayers: []
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    const player = result.players.find(p => p.number === 5);
    expect(player.name).toBe('Andersson');
  });
});

// ===========================================
// 3. Action parsing (skill, grade, team, player mapping)
// ===========================================
describe('dvwParserService.parseFile -- actions', () => {
  it('ska parsa en hemmalag-action korrekt', async () => {
    // * = hemmalag (H), player 16, Attack, grade #
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.23.45;a;b;c;d;1234'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions).toHaveLength(1);
    const action = result.actions[0];
    expect(action.team).toBe('H');
    expect(action.playerNumber).toBe(16);
    expect(action.playerName).toBe('Melker Nordin');
    expect(action.skill).toBe('A');
    expect(action.skillName).toBe('Attack');
    expect(action.grade).toBe('#');
    expect(action.gradeName).toBe('Perfekt');
  });

  it('ska parsa en bortalag-action korrekt (a prefix)', async () => {
    // a = bortalag (V), player 3, Serve, grade +
    const content = createDvwContent({
      scoutLines: [
        'a03ST+~~5C~62;foo;bar;baz;5050;mid;2575;02.10.05;a;b;c;d;5678'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions).toHaveLength(1);
    const action = result.actions[0];
    expect(action.team).toBe('V');
    expect(action.playerNumber).toBe(3);
    expect(action.playerName).toBe('Johan Karlsson');
    expect(action.skill).toBe('S');
    expect(action.skillName).toBe('Serve');
    expect(action.grade).toBe('+');
    expect(action.gradeName).toBe('Positiv');
  });

  it('ska anvanda #nummer om spelaren saknas', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*99AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].playerName).toBe('#99');
  });
});

// ===========================================
// 4. Skill remapping (E->P, F->G)
// ===========================================
describe('dvwParserService.parseFile -- skill remapping', () => {
  it('ska mappa E (Pass) till P', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16ET+~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].skill).toBe('P');
    expect(result.actions[0].skillName).toBe('Pass');
  });

  it('ska mappa F (Gratisboll) till G', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16FT!~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;200'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].skill).toBe('G');
    expect(result.actions[0].skillName).toBe('Gratisboll');
  });

  it('ska inte mappa vanliga skills (A, S, R, etc.)', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].skill).toBe('A');
  });
});

// ===========================================
// 5. Grade mapping
// ===========================================
describe('dvwParserService.parseFile -- grades', () => {
  const gradeTests = [
    { char: '#', name: 'Perfekt' },
    { char: '+', name: 'Positiv' },
    { char: '!', name: 'OK' },
    { char: '-', name: 'Negativ' },
    { char: '/', name: 'Error' },
    { char: '=', name: 'Error' }
  ];

  for (const { char, name } of gradeTests) {
    it('ska mappa grade ' + char + ' till ' + name, async () => {
      const content = createDvwContent({
        scoutLines: [
          '*16AT' + char + '~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100'
        ]
      });
      readFile.mockResolvedValue(content);

      const result = await dvwParserService.parseFile('match.dvw');

      expect(result.actions[0].grade).toBe(char);
      expect(result.actions[0].gradeName).toBe(name);
    });
  }
});

// ===========================================
// 6. Zone parsing (startZone, endZone)
// ===========================================
describe('dvwParserService.parseFile -- zones', () => {
  it('ska parsa startZone och endZone', async () => {
    // Code positions: 0=*, 1=1, 2=6, 3=A, 4=T, 5=#, 6=~, 7=~, 8=~, 9=6, 10=2, 11=~, 12=~
    // So startZone=6, endZone=2
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~~62~~;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].startZone).toBe(6);
    expect(result.actions[0].endZone).toBe(2);
  });

  it('ska returnera null for zoner med ~ (okanda)', async () => {
    // Code: *16AT#~~~~~~~ -- index 9='~', index 10='~'
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~~~~~~;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].startZone).toBeNull();
    expect(result.actions[0].endZone).toBeNull();
  });

  it('ska returnera null for zoner utanfor 1-9', async () => {
    // Code: *16AT#~~~00~~ -- index 9='0', index 10='0'
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~~00~~;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].startZone).toBeNull();
    expect(result.actions[0].endZone).toBeNull();
  });
});

// ===========================================
// 7. Coordinate parsing
// ===========================================
describe('dvwParserService.parseFile -- coordinates', () => {
  it('ska parsa startCoord och endCoord fran parts', async () => {
    // parts[4] = 5050 (center), parts[6] = 2575
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    // parseCoordinate(5050): x = (5050-1)%100 = 49, y = floor((5050-1)/100) = 50
    expect(result.actions[0].startCoord).toEqual({ x: 49, y: 50 });
    // parseCoordinate(2575): x = (2575-1)%100 = 74, y = floor((2575-1)/100) = 25
    expect(result.actions[0].endCoord).toEqual({ x: 74, y: 25 });
  });

  it('ska returnera null for ogiltiga koordinater', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;0;mid;99999;01.00.00;a;b;c;d;100'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].startCoord).toBeNull();
    expect(result.actions[0].endCoord).toBeNull();
  });

  it('ska returnera null for icke-numeriska koordinater', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;abc;mid;xyz;01.00.00;a;b;c;d;100'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].startCoord).toBeNull();
    expect(result.actions[0].endCoord).toBeNull();
  });
});

// ===========================================
// 8. Score events parsing
// ===========================================
describe('dvwParserService.parseFile -- score events', () => {
  it('ska parsa hemmalag poang (*p)', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100',
        '*p01:00'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.scoreboard).toHaveLength(1);
    expect(result.scoreboard[0].setScore).toEqual({ H: 1, V: 0 });
  });

  it('ska parsa bortalag poang (ap)', async () => {
    const content = createDvwContent({
      scoutLines: [
        'a03ST+~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100',
        'ap00:01'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.scoreboard).toHaveLength(1);
    expect(result.scoreboard[0].setScore).toEqual({ H: 0, V: 1 });
  });

  it('ska folja poangstallning genom flera poang', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100',
        '*p01:00',
        'a03ST+~~5C~62;foo;bar;baz;5050;mid;2575;01.01.00;a;b;c;d;200',
        'ap01:01',
        '*07AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.02.00;a;b;c;d;300',
        '*p02:01'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.scoreboard).toHaveLength(3);
    expect(result.scoreboard[0].setScore).toEqual({ H: 1, V: 0 });
    expect(result.scoreboard[1].setScore).toEqual({ H: 1, V: 1 });
    expect(result.scoreboard[2].setScore).toEqual({ H: 2, V: 1 });
  });
});

// ===========================================
// 9. Set tracking
// ===========================================
describe('dvwParserService.parseFile -- set tracking', () => {
  it('ska starta i set 1', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].set).toBe(1);
  });

  it('ska oka set efter **Nset markering', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100',
        '**1set',
        '*07AT+~~5C~62;foo;bar;baz;5050;mid;2575;01.30.00;a;b;c;d;200'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].set).toBe(1);
    expect(result.actions[1].set).toBe(2);
  });

  it('ska hantera flera setbyten korrekt', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100',
        '**1set',
        '*07AT+~~5C~62;foo;bar;baz;5050;mid;2575;01.30.00;a;b;c;d;200',
        '**2set',
        'a03DT!~~5C~62;foo;bar;baz;5050;mid;2575;02.00.00;a;b;c;d;300'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].set).toBe(1);
    expect(result.actions[1].set).toBe(2);
    expect(result.actions[2].set).toBe(3);
  });

  it('ska nollstalla poang efter setbyte i scoreboard', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100',
        '*p25:23',
        '**1set',
        '*07AT+~~5C~62;foo;bar;baz;5050;mid;2575;01.30.00;a;b;c;d;200'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    // First action gets the score after it
    expect(result.scoreboard[0].setScore).toEqual({ H: 25, V: 23 });
    // Second action is in set 2, score should reset
    expect(result.scoreboard[1].setScore).toEqual({ H: 0, V: 0 });
  });
});

// ===========================================
// 10. Path traversal protection
// ===========================================
describe('dvwParserService.parseFile -- path traversal', () => {
  it('ska kasta fel for ../ i sokvagen', async () => {
    await expect(dvwParserService.parseFile('../etc/passwd'))
      .rejects.toThrow('Invalid DVW path');
  });

  it('ska kasta fel for indirekt path traversal', async () => {
    await expect(dvwParserService.parseFile('subdir/../../etc/passwd'))
      .rejects.toThrow();
  });

  it('ska tillata normala sokvaegar', async () => {
    const content = createDvwContent();
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('matches/2024/match.dvw');

    expect(result).toBeDefined();
    expect(result.teams).toBeDefined();
  });

  it('ska hantera leading slash', async () => {
    const content = createDvwContent();
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('/matches/match.dvw');

    expect(result).toBeDefined();
    // readFile should have been called with path under STORAGE_PATH (/storage)
    expect(readFile).toHaveBeenCalledWith(
      expect.stringContaining('test-storage'),
      'latin1'
    );
  });
});

// ===========================================
// 11. Video time from frameNum
// ===========================================
describe('dvwParserService.parseFile -- videoTime', () => {
  it('ska anvanda frameNum som videoTime', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;1234'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].videoTime).toBe(1234);
  });

  it('ska returnera null om frameNum ar 0', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;0'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].videoTime).toBeNull();
  });

  it('ska returnera null om frameNum saknas', async () => {
    // Only 12 parts (index 0-11), missing index 12
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].videoTime).toBeNull();
  });
});

// ===========================================
// 12. Empty/malformed DVW data
// ===========================================
describe('dvwParserService.parseFile -- edge cases', () => {
  it('ska hantera tom DVW-fil', async () => {
    readFile.mockResolvedValue('');

    const result = await dvwParserService.parseFile('empty.dvw');

    expect(result.teams).toEqual({ H: 'Hemmalag', V: 'Bortalag' });
    expect(result.players).toEqual([]);
    expect(result.actions).toEqual([]);
    expect(result.scoreboard).toEqual([]);
  });

  it('ska hantera DVW utan scout-sektion', async () => {
    const content = [
      '[3TEAMS]',
      ';TestTeam A;;;;;',
      ';TestTeam B;;;;;',
      '[3PLAYERS-H]',
      '[3PLAYERS-V]'
    ].join('\n');
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('no-scout.dvw');

    expect(result.teams.H).toBe('TestTeam A');
    expect(result.teams.V).toBe('TestTeam B');
    expect(result.actions).toEqual([]);
  });

  it('ska skippa rader med okand skill', async () => {
    const content = createDvwContent({
      scoutLines: [
        // X is not a valid skill
        '*16XT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions).toHaveLength(0);
  });

  it('ska skippa rader med for fa delar', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions).toHaveLength(0);
  });

  it('ska skippa rader utan giltig tidsstampel', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;invalid;a;b;c;d;100'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions).toHaveLength(0);
  });

  it('ska parsa matchStart korrekt', async () => {
    const content = createDvwContent({ matchTime: '19.30.00' });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    // 19*3600 + 30*60 + 0 = 70200
    expect(result.matchStart).toBe(70200);
  });

  it('ska returnera zonePositions', async () => {
    const content = createDvwContent();
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.zonePositions).toBeDefined();
    expect(result.zonePositions[1]).toEqual({ x: 83, y: 75 });
    expect(result.zonePositions[6]).toEqual({ x: 50, y: 75 });
  });

  it('ska ge actions sekventiella id', async () => {
    const content = createDvwContent({
      scoutLines: [
        '*16AT#~~5C~62;foo;bar;baz;5050;mid;2575;01.00.00;a;b;c;d;100',
        '*07ST+~~5C~62;foo;bar;baz;5050;mid;2575;01.01.00;a;b;c;d;200',
        'a03RT!~~5C~62;foo;bar;baz;5050;mid;2575;01.02.00;a;b;c;d;300'
      ]
    });
    readFile.mockResolvedValue(content);

    const result = await dvwParserService.parseFile('match.dvw');

    expect(result.actions[0].id).toBe(0);
    expect(result.actions[1].id).toBe(1);
    expect(result.actions[2].id).toBe(2);
  });

  it('ska kasta fel om filen inte kan lasa', async () => {
    readFile.mockRejectedValue(new Error('ENOENT'));

    await expect(dvwParserService.parseFile('missing.dvw'))
      .rejects.toThrow('ENOENT');
  });
});
