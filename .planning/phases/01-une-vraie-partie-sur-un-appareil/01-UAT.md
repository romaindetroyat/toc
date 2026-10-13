---
status: testing
phase: 01-une-vraie-partie-sur-un-appareil
source: [01-VERIFICATION.md, 01-UI-REVIEW.md]
started: 2026-10-13T23:30:00Z
updated: 2026-10-13T23:30:00Z
---

## Current Test

number: 1
name: Son sur un vrai iPhone
expected: |
  Les sabots, hennissements et sons de cartes se font entendre dès le premier toucher. Après un retour d'arrière-plan, le prochain toucher relance le son. Le bouton « Réessayer » du toast fonctionne si le son ne démarre pas.
awaiting: user response

## Tests

### 1. Son sur un vrai iPhone (Safari, puis l'app ajoutée à l'écran d'accueil)
expected: Les sabots, hennissements et sons de cartes se font entendre dès le premier toucher. Après un retour d'arrière-plan, le prochain toucher relance le son. « Réessayer » fonctionne si le son ne démarre pas.
result: [pending]

### 2. Les sons à l'oreille (#/sons puis une partie entière)
expected: Hennissements reconnaissables et agréables, cadence des sabots qui suit la vitesse, ambiance discrète. Chaque son noté « À écouter · Bon · À changer ».
result: [pending]

### 3. Lisibilité des cavaliers (petit téléphone et 1280x800)
expected: Les seize cavaliers restent lisibles et distinguables en quatre couleurs (jaune sur le chêne compris), on reconnaît leur direction et la lettre A–D des cavaliers allumés.
result: [pending]

### 4. Plateau réduit sur téléphone de faible hauteur (320x480, 360x640)
expected: Pas de défilement de la page, plateau assez grand pour viser un cheval au doigt. (La revue visuelle juge 320x480 trop petit : environ 155 px de plateau.)
result: [pending]

### 5. Rythme et animations d'une partie en vitesse normale (As, Roi, 4, Valet, 7)
expected: Rythme naturel ; ruade et éjection en arc, bonds croisés du Valet, fête du 4e cheval plaisants et lisibles.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
