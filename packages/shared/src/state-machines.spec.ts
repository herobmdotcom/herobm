import * as StateMachines from './state-machines';

describe('State Machines', () => {
  describe('Integrity Constraints', () => {
    it('should have valid destinations for all transition maps', () => {
      // We will iterate over all exported objects that end with _TRANSITIONS
      const exportsList = Object.entries(StateMachines);
      let foundMaps = 0;

      for (const [exportName, exportValue] of exportsList) {
        if (exportName.endsWith('_TRANSITIONS')) {
          foundMaps++;
          const transitionMap = exportValue as Record<string, string[]>;
          
          // Verify that every single state defined in the values array exists as a key in the map itself!
          // This prevents "dead-end" states or typos where a transition leads nowhere.
          for (const [sourceState, allowedDestinations] of Object.entries(transitionMap)) {
            for (const destState of allowedDestinations) {
              if (transitionMap[destState] === undefined) {
                throw new Error(
                  `Integrity Violation in ${exportName}: The state '${sourceState}' allows a transition to '${destState}', but '${destState}' is not defined as a valid source state key in the map!`
                );
              }
            }
          }
        }
      }

      // Sanity check to make sure our dynamic reflection actually found maps
      expect(foundMaps).toBeGreaterThan(5);
    });

    it('should allow Purchase Orders in ORDERED state to transition back to DRAFT', () => {
      expect(StateMachines.PURCHASE_ORDER_TRANSITIONS[StateMachines.PURCHASE_ORDER_STATE.ORDERED]).toContain(
        StateMachines.PURCHASE_ORDER_STATE.DRAFT
      );
    });
  });

  describe('Helper Functions', () => {
    const TEST_TRANSITIONS = {
      'draft': ['confirmed', 'cancelled'],
      'confirmed': ['shipped'],
      'shipped': [],
      'cancelled': []
    };

    it('getAllowedTransitions should return correct arrays', () => {
      expect(StateMachines.getAllowedTransitions(TEST_TRANSITIONS, 'draft')).toEqual(['confirmed', 'cancelled']);
      expect(StateMachines.getAllowedTransitions(TEST_TRANSITIONS, 'shipped')).toEqual([]);
      // Should handle unknown states safely
      expect(StateMachines.getAllowedTransitions(TEST_TRANSITIONS, 'unknown_state')).toEqual([]);
    });

    it('getValidStates should return map keys', () => {
      expect(StateMachines.getValidStates(TEST_TRANSITIONS)).toEqual([
        'draft', 'confirmed', 'shipped', 'cancelled'
      ]);
    });

    it('isBackTransition should determine if the new state is backwards', () => {
      // In lifecycle: draft -> confirmed -> shipped
      const lifecycleStates = {
        'draft': 0,
        'confirmed': 1,
        'shipped': 2,
        'cancelled': 99
      };
      
      // Moving forward
      expect(StateMachines.isBackTransition(lifecycleStates, 'draft', 'confirmed')).toBe(false);
      
      // Moving backward
      expect(StateMachines.isBackTransition(lifecycleStates, 'shipped', 'confirmed')).toBe(true);
      expect(StateMachines.isBackTransition(lifecycleStates, 'confirmed', 'draft')).toBe(true);
      
      // Cancelled is hardcoded as back transition usually... wait, the logic says:
      // return (lifecycle[to] ?? 99) < (lifecycle[from] ?? 99) && to !== SALES_ORDER_STATE.CANCELLED;
      // So if 'to' is cancelled, it is NEVER a back transition.
      expect(StateMachines.isBackTransition(lifecycleStates, 'confirmed', 'cancelled')).toBe(false);
    });

    it('cap should capitalize strings properly', () => {
      expect(StateMachines.cap('draft')).toBe('Draft');
      expect(StateMachines.cap('PARTIALLY_RECEIVED')).toBe('PARTIALLY_RECEIVED');
      expect(StateMachines.cap('')).toBe('');
      expect(StateMachines.cap('a')).toBe('A');
    });
  });
});
