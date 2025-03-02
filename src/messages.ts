const generateMessage = (message: string) => ({ message });

export const INVALID_REQUEST = generateMessage('INVALID_REQUEST');
export const NO_CREDITS = generateMessage('NO_CREDITS');
export const GENERATE_JOURNEY_ERROR = generateMessage('GENERATE_JOURNEY_ERROR');
