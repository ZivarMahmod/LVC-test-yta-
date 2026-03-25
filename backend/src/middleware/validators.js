// ===========================================
// LVC Media Hub — Inputvalidering
// ===========================================
import { body, param, query } from 'express-validator';

// -------------------------------------------
// Inloggning
// -------------------------------------------
export const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Ange en giltig e-postadress.'),
  body('password')
    .isString()
    .isLength({ min: 1, max: 128 })
    .withMessage('Lösenord krävs.')
];

// -------------------------------------------
// Skapa användare (admin)
// -------------------------------------------
export const createUserValidation = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Ange en giltig e-postadress.'),
  body('name')
    .trim()
    .isString()
    .isLength({ min: 2, max: 100 })
    .escape()
    .withMessage('Namn måste vara 2–100 tecken.'),
  body('password')
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('Lösenord måste vara minst 8 tecken.'),
  body('role')
    .isIn(['admin', 'uploader', 'viewer'])
    .withMessage('Ogiltig roll. Välj admin, uploader eller viewer.')
];

// -------------------------------------------
// Uppdatera användare (admin)
// -------------------------------------------
export const updateUserValidation = [
  param('id').isUUID().withMessage('Ogiltigt användar-ID.'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Ange en giltig e-postadress.'),
  body('name')
    .optional()
    .trim()
    .isString()
    .isLength({ min: 2, max: 100 })
    .escape()
    .withMessage('Namn måste vara 2–100 tecken.'),
  body('password')
    .optional()
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('Lösenord måste vara minst 8 tecken.'),
  body('role')
    .optional()
    .isIn(['admin', 'uploader', 'viewer'])
    .withMessage('Ogiltig roll.'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive måste vara sant eller falskt.')
];

// -------------------------------------------
// Videouppladdning
// -------------------------------------------
export const uploadVideoValidation = [
  body('opponent')
    .trim()
    .isString()
    .isLength({ min: 1, max: 200 })
    .escape()
    .withMessage('Motståndare krävs (max 200 tecken).'),
  body('matchDate')
    .isISO8601()
    .toDate()
    .withMessage('Ogiltigt datum. Använd formatet ÅÅÅÅ-MM-DD.'),
  body('description')
    .optional()
    .trim()
    .isString()
    .isLength({ max: 1000 })
    .escape()
    .withMessage('Beskrivning får vara max 1000 tecken.')
];

// -------------------------------------------
// Video ID-parameter
// -------------------------------------------
export const videoIdValidation = [
  param('id').isUUID().withMessage('Ogiltigt video-ID.')
];

// -------------------------------------------
// Användar ID-parameter
// -------------------------------------------
export const userIdValidation = [
  param('id').isUUID().withMessage('Ogiltigt användar-ID.')
];

// -------------------------------------------
// Sökvalidering
// -------------------------------------------
export const searchValidation = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Ogiltigt sidnummer.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Ogiltig gräns (1–50).'),
  query('search')
    .optional()
    .trim()
    .isString()
    .isLength({ max: 200 })
    .escape()
    .withMessage('Söksträng för lång.')
];
