// Mock react-native for Node test environment
jest.mock('react-native', () => {
  return {
    useColorScheme: jest.fn(() => 'dark'),
    Platform: {
      OS: 'android',
      select: (objs) => objs.android || objs.default || objs.ios,
    },
    StyleSheet: {
      create: (s) => s,
    },
    View: 'View',
    Text: 'Text',
  };
});
