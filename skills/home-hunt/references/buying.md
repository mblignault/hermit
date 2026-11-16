# Buying

Buying uses the same profile with `mode: "buy"`. `budget` is the purchase price, and these change:

## Affordability

Monthly repayment on a standard amortising loan:

```
P = price − deposit,  r = annual rate / 12,  n = years × 12
repayment = P·r / (1 − (1 + r)^−n)
```

`score.js` exports `monthlyRepayment(principal, ratePct, years)`. The price part adds levies, HOA, body-corporate or strata fees and monthly rates or property tax (`facts.levies`, `facts.rates`), and compares the total with `finance.maxShare` (default 30%) of `finance.monthlyNetIncome`. Over the limit, the listing gets a flag and its price fraction is capped at 0.3.

At setup, if they haven't been pre-approved, recommend they get pre-approval first. Use the lender's number as `budget.max`, not your estimate.

## Upfront costs

Each country has its own transfer or stamp duty, registration, legal and conveyancing fees. **Look up the current rates at setup** (they change, often every year) and note the total cash needed for their target price in one line. The country pack's `buy.upfrontCosts` lists what to look up. Never use rates from memory.

## Extra facts to extract

`levies`, `rates`, `sizeM2`, erf or plot size (`facts.plotM2`), the year built (`facts.built`), sectional title or freehold (`facts.tenure`), days on market and price history (cut prices signal room to negotiate), and any special levies or known defects in the description.

## Lanes

Apply becomes **Offer**. Before anything goes into Offer, add these to the ask list: a recent comparable sales check, the levy or HOA statement and minutes for sectional title, a building inspection, and what's included in the sale.
