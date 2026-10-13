import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  getWalletBalance, 
  updateWalletBalance, 
  deductWalletBalance, 
  formatWalletBalance,
  setAuthSession,
  clearAuthSession,
  getToken,
  getUser,
  isAuthenticated
} from '../src/utils/authService.js';
import { createJourney, getLocalJourneys } from '../src/utils/journeyService.js';

test('Wallet Service - defaults to ₹1,000 for authenticated or initial state', () => {
  clearAuthSession();
  const initial = getWalletBalance();
  assert.equal(initial, 1000);
  assert.equal(formatWalletBalance(initial), '₹1,000.00');
});

test('Wallet Service - updateWalletBalance adds funds accurately and validates input', () => {
  clearAuthSession();
  const starting = getWalletBalance();
  const afterTopUp = updateWalletBalance(250);
  assert.equal(afterTopUp, starting + 250);
  assert.equal(formatWalletBalance(afterTopUp), '₹1,250.00');

  // Input validation
  assert.throws(() => updateWalletBalance(-50), /valid positive/i);
  assert.throws(() => updateWalletBalance('invalid'), /valid positive/i);
});

test('Wallet Service - deductWalletBalance subtracts fare and blocks insufficient balance', () => {
  clearAuthSession();
  const starting = getWalletBalance(); // 1000
  const fare = 150;
  const remaining = deductWalletBalance(fare);
  assert.equal(remaining, starting - fare);
  assert.equal(getWalletBalance(), remaining);

  // Attempting to deduct more than balance throws insufficient balance error
  assert.throws(() => deductWalletBalance(5000), /insufficient wallet balance/i);
});

test('Auth Service - setAuthSession and clearAuthSession manage state cleanly', () => {
  clearAuthSession();
  assert.equal(isAuthenticated(), false);
  assert.equal(getToken(), null);
  assert.equal(getUser(), null);

  const mockToken = 'mock_jwt_test_token_12345';
  const mockUser = { id: 42, name: 'Yashwanth Chodipalli', email: 'yash@example.com' };

  setAuthSession(mockToken, mockUser);
  assert.equal(isAuthenticated(), true);
  assert.equal(getToken(), mockToken);
  assert.deepEqual(getUser(), mockUser);

  // Clearing session resets auth state
  clearAuthSession();
  assert.equal(isAuthenticated(), false);
  assert.equal(getToken(), null);
  assert.equal(getUser(), null);
});

test('Ticket Booking Workflow - Fare calculation, wallet deduction, and PNR generation', async () => {
  const mockUser = { id: 101, name: 'Yashwanth Chodipalli', email: 'yash@example.com' };
  setAuthSession('mock_token_booking', mockUser);

  // 1. Initial wallet balance defaults to 1,000
  const initialBalance = getWalletBalance();
  assert.equal(initialBalance, 1000);

  // 2. Calculate fare for 142.5 km at ₹1.5/km
  const distanceKm = 142.5;
  const ratePerKm = 1.5;
  const expectedFare = Math.max(30, Math.round(distanceKm * ratePerKm * 100) / 100);
  assert.equal(expectedFare, 213.75);

  // 3. Deduct fare from wallet
  const newBalance = deductWalletBalance(expectedFare);
  assert.equal(newBalance, 786.25);
  assert.equal(getWalletBalance(), 786.25);
  assert.equal(formatWalletBalance(newBalance), '₹786.25');

  // 4. Generate mock 10-digit PNR
  const pnrPart1 = Math.floor(100 + Math.random() * 900);
  const pnrPart2 = Math.floor(1000000 + Math.random() * 9000000);
  const mockPnr = `${pnrPart1}-${pnrPart2}`;
  assert.match(mockPnr, /^\d{3}-\d{7}$/);

  // 5. Create booked journey record
  const journey = await createJourney({
    trainNumber: '12007',
    trainName: 'Chennai Mysore Shatabdi Express',
    boardingStation: 'Chennai Central',
    destinationStation: 'KSR Bengaluru',
    alertDistance: 10,
    status: 'booked',
    pnr: mockPnr,
    fare: expectedFare,
    distanceKm: distanceKm
  });

  assert.ok(journey);
  assert.equal(journey.trainNumber, '12007');
  assert.equal(journey.status, 'booked');
  assert.equal(journey.pnr, mockPnr);
  assert.equal(journey.fare, expectedFare);

  // 6. Verify journey in local storage list
  const allJourneys = getLocalJourneys();
  const matched = allJourneys.find(j => j.pnr === mockPnr);
  assert.ok(matched);
  assert.equal(matched.pnr, mockPnr);

  // 7. Test Insufficient Balance blocking
  // Current balance is 786.25. Attempting to book a 600km journey (fare: 600 * 1.5 = 900)
  const expensiveFare = 900;
  assert.throws(
    () => deductWalletBalance(expensiveFare),
    /insufficient wallet balance/i
  );

  // 8. Top up wallet with +₹500 and verify booking can proceed
  updateWalletBalance(500);
  assert.equal(getWalletBalance(), 1286.25);
  const balanceAfterExpensive = deductWalletBalance(expensiveFare);
  assert.equal(balanceAfterExpensive, 386.25);
});
