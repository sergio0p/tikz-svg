# E510 Algorithms Reference

Source: https://sergio0p.github.io/E510/LECWeb/

## Recipe #0 — Unconstrained Optimization

1. Obtain the gradient of the objective function
2. Solve the system of first-order conditions (FOC): set gradient = 0
3. Identify candidate solutions from the FOC results
4. Evaluate the function at each candidate solution and pick those yielding the highest value

## Recipe #1 — Lagrangian Method (Equality Constraints)

1. Set up the maximization problem — define objective function, choice variables, and constraints
2. Write the Lagrangian: objective function minus the difference of LHS and RHS of constraints, weighted by the corresponding Lagrangian multiplier
3. Apply unconstrained optimization (Recipe #0) to the Lagrangian with expanded choice variables (x and λ)
4. Solve the gradient-equals-zero condition: ∇L = 0
5. Verify whether solutions represent maxima or minima
6. Conduct comparative statics analysis

## Recipe #2 — KKT Method (Inequality Constraints)

1. Write the maximization problem with all constraints in the form g_j(x) ≤ c_j
2. Construct the corresponding Lagrangian
3. List all possible cases for the Lagrange multipliers (λ_j > 0 or λ_j = 0) in a table
4. For each case, designate positive multipliers as λ⁺ and zero multipliers as λ⁰
5. Set λ⁰ = 0 in the Lagrangian, apply Recipe #1 with variables x and λ⁺:
   - Solve ∇_{x,λ⁺} L = 0 for x and λ⁺
   - Verify that λ⁺ > 0 as assumed
   - Verify that slack constraints satisfy g_j(x) ≤ c_j
6. If both verifications pass → valid solution. Otherwise test the next case.

## Backward Induction — Subgame Perfect Equilibrium

1. Start at the final period T. The last mover chooses an action to maximize their payoff given the history of play. Solve for the optimal action as a function of that history.
2. The solution at period T defines the value of the subgame starting at T. This value depends on the actions taken in earlier periods.
3. Move to period T−1. The player moving at T−1 anticipates how the player at T will respond. Substitute the optimal action from T into the T−1 player's objective function.
4. The T−1 player now faces a reduced problem: maximize their payoff where the continuation value (from T onward) is already determined by the subgame solution.
5. Repeat: solve for the optimal action at T−1, defining the subgame value at T−1. Move to T−2 and continue. The process terminates at period 1, yielding the subgame perfect equilibrium path.

## Recursive Method — Value Function Iteration

**Bellman Equation:**

V(K) = max_{0 ≤ c ≤ K} u(c) + δ · V(K − c)

**Policy Function:** c*(K) solves the FOC: u'(c) − δ · V'(K − c) = 0

**Iteration Algorithm:**

1. Start with an initial guess V₀(K)
2. Solve the FOC for the policy function c₀*(K)
3. Compute the new value function: V₁(K) = u(c₀*(K)) + δ · V₀(K − c₀*(K))
4. Repeat until convergence — under certain conditions, Vₙ → V
