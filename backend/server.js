const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5678;

const poolConfig = {
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/personality_engine',
};

if (process.env.NODE_ENV === 'production') {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new Pool(poolConfig);

app.use(cors());
app.use(express.json());

pool.on('error', (error) => {
  console.error('Unexpected Postgres error', error);
});

/**
 * The Question Bank defines the personality dimensions we measure.
 * 
 * - key: Unique identifier for the question.
 * - text: The prompt shown to the user.
 * - axis: Which personality dimension this affects (Openness, Empathy, Drive, Intuition).
 * - direction: 1 (Agreeing increases the score) or -1 (Agreeing decreases it).
 */
const questionBank = [
  {
    key: 'curiosity',
    text: 'You prefer exploring new ideas even if there is risk involved.',
    axis: 'openness',
    direction: 1,
  },
  {
    key: 'tradition',
    text: 'You feel safest when you stick to known routines.',
    axis: 'openness',
    direction: -1,
  },
  {
    key: 'empathy',
    text: 'People often tell you they feel heard after talking with you.',
    axis: 'empathy',
    direction: 1,
  },
  {
    key: 'detachment',
    text: 'You remain emotionally distant when solving problems.',
    axis: 'empathy',
    direction: -1,
  },
  {
    key: 'drive',
    text: 'You pursue ambitious goals relentlessly.',
    axis: 'drive',
    direction: 1,
  },
  {
    key: 'restraint',
    text: 'You prefer pacing yourself and prioritizing balance.',
    axis: 'drive',
    direction: -1,
  },
  {
    key: 'intuition',
    text: 'Gut feelings guide big choices.',
    axis: 'intuition',
    direction: 1,
  },
  {
    key: 'analysis',
    text: 'You analyze problems logically before trusting inspiration.',
    axis: 'intuition',
    direction: -1,
  },
];

const scenarios = [
  {
    key: 'pressure',
    title: 'Deadline pressure',
    prompt: 'A last-minute pivot slides into your inbox with impossible timing.',
  },
  {
    key: 'conflict',
    title: 'Team conflict',
    prompt: 'Two collaborators disagree about a core value, and the deadline looms.',
  },
  {
    key: 'opportunity',
    title: 'Unexpected opportunity',
    prompt: 'A spontaneous invitation promises fame but demands vulnerability.',
  },
];

const traitDefinitions = {
  openness: 'You embrace imagination, spontaneity, and novel perspectives.',
  empathy: 'Others feel seen because you mirror kindness and listen deeply.',
  drive: 'You navigate ambition, momentum, and focused action.',
  intuition: 'There is a poetic sense you follow signals beyond the data.',
};

const createSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      alias TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS answers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      question_key TEXT NOT NULL,
      answer_value INTEGER NOT NULL,
      answer_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scoring_matrix (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      axis TEXT NOT NULL,
      score NUMERIC NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS personality_traits (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      trait TEXT NOT NULL,
      description TEXT,
      weight INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scenario_responses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      scenario_key TEXT NOT NULL,
      reaction TEXT,
      outlook TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
};

const ensureAliasColumn = async () => {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS alias TEXT`);

  const result = await pool.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'name'
      LIMIT 1
    `
  );

  if (result.rowCount > 0) {
    await pool.query(`UPDATE users SET alias = name WHERE alias IS NULL`);
  }
};

/**
 * Step 1: Normalize user inputs into Axis Scores.
 * 
 * We iterate through the question bank, apply the "direction" multiplier,
 * and calculate a secondary score for each axis. We add a base of 3 so
 * that scores usually land between 1 and 5.
 */
const evaluateScores = (answers) => {
  const axisTotals = {
    openness: 0,
    empathy: 0,
    drive: 0,
    intuition: 0,
  };
  const axisCount = {
    openness: 0,
    empathy: 0,
    drive: 0,
    intuition: 0,
  };

  questionBank.forEach((question) => {
    const raw = Number(answers[question.key] ?? 3);
    const normalized = Math.min(5, Math.max(1, raw));
    axisTotals[question.axis] += normalized * question.direction;
    axisCount[question.axis] += 1;
  });

  const normalizedScores = {};
  Object.entries(axisTotals).forEach(([axis, total]) => {
    const divisor = axisCount[axis] || 1;
    normalizedScores[axis] = Number((total / divisor + 3).toFixed(2));
  });

  return normalizedScores;
};

/**
 * Step 2: Map personality scores to Narrative Characters.
 * 
 * Here the "Simulation" happens. We identify the top-performing traits
 * and use them to select a primary "Character Name" and "Arc".
 * This gives the data a human, storytelling quality for the portfolio.
 */
const craftCharacters = (scores, answers) => {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topTrait = sorted[0][0];
  const nextTrait = sorted[1][0];

  return [
    {
      name: `Nova ${topTrait.charAt(0).toUpperCase() + topTrait.slice(1)}`,
      arc: 'Futurebound architect',
      summary: `Your answers sketch a ${traitDefinitions[topTrait]} explorer who keeps ${nextTrait} steady.`,
      persona: `Sees the world as layered gradients of ${Object.keys(scores).join(', ')}.`,
    },
    {
      name: 'Mirror Warden',
      arc: 'Perception curator',
      summary: 'You narrate how others probably perceive you—calm, precise, brave.',
      persona: `Reflects ${scores.empathy > 3 ? 'warmth' : 'a cool focus'} when translating feelings to stories.`,
    },
    {
      name: 'Quiet Architect',
      arc: 'Strategic storyteller',
      summary: 'A synthesis of emotional depth and disciplined drive that anchors every scene.',
      persona: 'Predicts how you would respond when scenarios push the edge.',
    },
  ];
};

const craftScenarioResponse = (scenario, scores) => {
  const decisiveness = scores.drive > 3 ? 'decisively reshapes' : 'pauses to listen before reshaping';
  const connection = scores.empathy > 3 ? 'with genuine warmth' : 'with curious objectivity';

  return {
    scenarioKey: scenario.key,
    reaction: `${decisiveness} the situation described by “${scenario.prompt}”.`,
    outlook: `Others probably see you respond ${connection} and keep the story immersive.`,
  };
};

app.get('/', (req, res) => {
  res.send('Personality Simulation Engine API ready.');
});

app.get('/api/questions', (req, res) => {
  res.json(questionBank);
});

app.post('/api/interpret', async (req, res) => {
  try {
    const { alias = 'Curious Guest', answers } = req.body;
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'Answers are required.' });
    }

    // Step 1: Record the simulation session to our primary Users table.
    const userResult = await pool.query('INSERT INTO users (alias) VALUES ($1) RETURNING *', [alias]);
    const userId = userResult.rows[0].id;

    // Step 2: Persist the raw slider values (1-5) for each psychological axis.
    // This allows us to track historically how someone's inputs have evolved.
    await Promise.all(
      questionBank.map((question) =>
        pool.query(
          'INSERT INTO answers (user_id, question_key, answer_value, answer_text) VALUES ($1, $2, $3, $4)',
          [userId, question.key, Number(answers[question.key] ?? 3), question.text]
        )
      )
    );

    // Step 3: Run the scoring logic (normalize inputs into 1-5 axis values).
    const scores = evaluateScores(answers);

    // Step 4: Record the calculated analysis (Scoring Matrix) into Postgres.
    await Promise.all(
      Object.entries(scores).map(([axis, score]) =>
        pool.query('INSERT INTO scoring_matrix (user_id, axis, score) VALUES ($1, $2, $3)', [userId, axis, score])
      )
    );

    const sortedTraits = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([trait, value], index) => ({
        trait,
        description: traitDefinitions[trait],
        weight: Math.max(1, 5 - index),
      }));

    await Promise.all(
      sortedTraits.map((trait) =>
        pool.query(
          'INSERT INTO personality_traits (user_id, trait, description, weight) VALUES ($1, $2, $3, $4)',
          [userId, trait.trait, trait.description, trait.weight]
        )
      )
    );

    const scenarioResponses = scenarios.map((scenario) => {
      const { scenarioKey, reaction, outlook } = craftScenarioResponse(scenario, scores);
      return { scenarioKey, reaction, outlook };
    });

    await Promise.all(
      scenarioResponses.map((response) =>
        pool.query(
          'INSERT INTO scenario_responses (user_id, scenario_key, reaction, outlook) VALUES ($1, $2, $3, $4)',
          [userId, response.scenarioKey, response.reaction, response.outlook]
        )
      )
    );

    const characters = craftCharacters(scores, answers);
    const perception = `Others probably see you as a ${characters[1].arc.toLowerCase()}.`;

    res.status(201).json({
      user: userResult.rows[0],
      characters,
      scenarioResponses,
      perception,
      scores,
    });
  } catch (error) {
    console.error('POST /api/interpret failed', error);
    res.status(500).json({ error: 'Unable to interpret your profile.' });
  }
});

const start = async () => {
  try {
    await createSchema();
    await ensureAliasColumn();
    app.listen(PORT, () => {
      console.log(`Personality Simulation Engine listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server', error);
    process.exit(1);
  }
};

start();
