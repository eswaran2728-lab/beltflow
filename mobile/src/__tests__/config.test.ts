import { Colors } from '../theme/colors';
import appConfig from '../../app.json';

describe('BeltFlow Mobile — Phase 1 Task 1.1 Configuration', () => {
  test('Design system color palette matches brand specifications', () => {
    expect(Colors.navy).toBe('#0D2B47');
    expect(Colors.navyDark).toBe('#061828');
    expect(Colors.navyLight).toBe('#153C61');
    expect(Colors.amber).toBe('#F2941C');
    expect(Colors.slate).toBe('#F8FAFC');
    expect(Colors.success).toBe('#10B981');
    expect(Colors.danger).toBe('#EF4444');
  });

  test('app.json targets Android package com.beltflow.app', () => {
    expect(appConfig.expo.android.package).toBe('com.beltflow.app');
  });

  test('app.json targets iOS bundle identifier com.beltflow.app', () => {
    expect(appConfig.expo.ios.bundleIdentifier).toBe('com.beltflow.app');
  });

  test('app.json defines BeltFlow name and portrait orientation', () => {
    expect(appConfig.expo.name).toBe('BeltFlow');
    expect(appConfig.expo.slug).toBe('beltflow');
    expect(appConfig.expo.orientation).toBe('portrait');
  });

  test('Belt colors are properly enumerated', () => {
    expect(Colors.belts.white).toBeDefined();
    expect(Colors.belts.yellow).toBeDefined();
    expect(Colors.belts.orange).toBeDefined();
    expect(Colors.belts.green).toBeDefined();
    expect(Colors.belts.blue).toBeDefined();
    expect(Colors.belts.purple).toBeDefined();
    expect(Colors.belts.brown).toBeDefined();
    expect(Colors.belts.red).toBeDefined();
    expect(Colors.belts.black).toBeDefined();
  });
});
