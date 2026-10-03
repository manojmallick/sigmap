'use strict';

/**
 * Objective-C extractor integration tests.
 * Run: node test/integration/objc-language.test.js
 */

const assert = require('assert');
const objc = require('../../src/extractors/objc');
const generic = require('../../src/extractors/generic');
const dispatch = require('../../src/extractors/dispatch');
const { lineAt } = require('../../src/extractors/line-anchor');
const { stripComments, maskCode } = require('../../src/extractors/scan');

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    pass++;
  } catch (e) {
    console.log(`  FAIL  ${name}\n        ${e.message}`);
    fail++;
  }
}

test('extract returns empty array on empty or non-string input', () => {
  assert.deepStrictEqual(objc.extract(''), []);
  assert.deepStrictEqual(objc.extract('   \n  '), []);
  assert.deepStrictEqual(objc.extract(null), []);
  assert.deepStrictEqual(objc.extract(undefined), []);
});

test('scanner preserves exact string length and newline count', () => {
  const src = `// License header
/* Multi-line
   comment */
#import <Foundation/Foundation.h>

@interface Test : NSObject
// Property comment
@property (nonatomic) NSString *text;
- (void)run;
@end
`;
  const stripped = stripComments(src);
  const masked = maskCode(src);
  assert.strictEqual(stripped.length, src.length, 'stripped length must match original');
  assert.strictEqual(masked.length, src.length, 'masked length must match original');
  assert.strictEqual(stripped.split('\n').length, src.split('\n').length, 'stripped line count must match');
  assert.strictEqual(masked.split('\n').length, src.split('\n').length, 'masked line count must match');
});

test('MATLAB .m file with no ObjC markers delegates to generic extractor', () => {
  const matlabCode = `
% MATLAB / Octave script
function calculateMetrics(x, scale)
    y1 = x * scale;
    y2 = x / scale;
end

function helper(data)
    result = sum(data);
end
`;
  const objcResult = objc.extract(matlabCode);
  const genericResult = generic.extract(matlabCode);
  assert.deepStrictEqual(objcResult, genericResult, 'MATLAB .m must yield generic extractor output');
  assert.ok(objcResult.length > 0, 'Generic extractor should have extracted functions');
});

test('extracts @interface, @protocol, and @implementation with correct anchors', () => {
  const src = `// License header line 1
// License header line 2

#import <Foundation/Foundation.h>

@protocol UserDescribing <NSObject>
@required
- (NSString *)userDescription;
@optional
- (void)optionalPing;
@end

@interface User : NSObject <UserDescribing>
@property (nonatomic, copy) NSString *name;
@property (nonatomic, readonly) NSInteger age;

+ (instancetype)userWithName:(NSString *)name age:(NSInteger)age;
- (NSString *)nameForUser:(User *)user options:(NSDictionary *)opts;
@end

@interface User (Networking)
- (void)syncWithServer:(NSURL *)url;
@end

@implementation User
+ (instancetype)userWithName:(NSString *)name age:(NSInteger)age {
    return [[self alloc] init];
}
- (NSString *)nameForUser:(User *)user options:(NSDictionary *)opts {
    return _name;
}
@end
`;

  const sigs = objc.extract(src);

  // Check @protocol
  const protoSig = sigs.find((s) => s.startsWith('@protocol UserDescribing'));
  assert.ok(protoSig, 'Protocol declaration extracted');
  assert.ok(protoSig.includes(':6-11'), `@protocol line anchor should be :6-11, got: ${protoSig}`);

  // Check methods inside protocol
  assert.ok(sigs.some((s) => s.includes('- (NSString *)userDescription')), 'Required method extracted');
  assert.ok(sigs.some((s) => s.includes('- (void)optionalPing')), 'Optional method extracted');

  // Check @interface with superclass (and stripped <UserDescribing>)
  const ifaceSig = sigs.find((s) => s.startsWith('@interface User : NSObject'));
  assert.ok(ifaceSig, '@interface User : NSObject extracted');
  assert.ok(ifaceSig.includes(':13-19'), `@interface line anchor should be :13-19, got: ${ifaceSig}`);

  // Check category
  const catSig = sigs.find((s) => s.startsWith('@interface User (Networking)'));
  assert.ok(catSig, 'Category interface extracted');
  assert.ok(catSig.includes(':21-23'), `Category line anchor should be :21-23, got: ${catSig}`);

  // Check @implementation
  const implSig = sigs.find((s) => s.startsWith('@implementation User'));
  assert.ok(implSig, '@implementation User extracted');
  assert.ok(implSig.includes(':25-32'), `@implementation line anchor should be :25-32, got: ${implSig}`);
});

test('extracts properties preserving attributes in parentheses', () => {
  const src = `
@interface Profile : NSObject
@property (nonatomic, copy, readonly) NSString *displayName;
@property (weak) id<ProfileDelegate> delegate;
@property NSInteger score;
@end
`;
  const sigs = objc.extract(src);
  assert.ok(sigs.some((s) => s.includes('@property (nonatomic, copy, readonly) NSString *displayName')), 'Attributes preserved');
  assert.ok(sigs.some((s) => s.includes('@property (weak) id<ProfileDelegate> delegate')), 'Weak delegate preserved');
  assert.ok(sigs.some((s) => s.includes('@property NSInteger score')), 'Plain property preserved');
});

test('handles balanced parens in block-typed parameters without truncation', () => {
  const src = `
@interface NetworkManager : NSObject
- (void)fetchResource:(NSString *)path completion:(void (^)(NSError *error, id result))completion;
- (void)processWithHandler:(void (^)(void))handler;
@end
`;
  const sigs = objc.extract(src);

  // The block type parameter `(void (^)(NSError *error, id result))` must survive intact
  const fetchSig = sigs.find((s) => s.includes('fetchResource:'));
  assert.ok(fetchSig, 'fetchResource method found');
  assert.ok(fetchSig.includes('completion:(void (^)(NSError *error, id result))completion'), `Nested block parameter must be balanced, got: ${fetchSig}`);

  const handlerSig = sigs.find((s) => s.includes('processWithHandler:'));
  assert.ok(handlerSig, 'processWithHandler method found');
  assert.ok(handlerSig.includes('processWithHandler:(void (^)(void))handler'), `Block with void must be balanced, got: ${handlerSig}`);
});

test('strips trailing Swift annotations and macros from method signatures', () => {
  const src = `
@interface Service : NSObject
- (instancetype)initWithConfig:(NSDictionary *)config NS_DESIGNATED_INITIALIZER;
- (void)performActionWithCompletion:(void (^)(BOOL))cb NS_SWIFT_NAME(performAction(_:));
+ (instancetype)new NS_UNAVAILABLE;
@end
`;
  const sigs = objc.extract(src);
  const initSig = sigs.find((s) => s.includes('initWithConfig:'));
  assert.ok(initSig, 'initWithConfig method found');
  assert.ok(!initSig.includes('NS_DESIGNATED_INITIALIZER'), 'NS_DESIGNATED_INITIALIZER stripped');

  const actionSig = sigs.find((s) => s.includes('performActionWithCompletion:'));
  assert.ok(actionSig, 'performAction method found');
  assert.ok(!actionSig.includes('NS_SWIFT_NAME'), 'NS_SWIFT_NAME stripped');

  const newSig = sigs.find((s) => s.includes('+ (instancetype)new'));
  assert.ok(newSig, 'new method found');
  assert.ok(!newSig.includes('NS_UNAVAILABLE'), 'NS_UNAVAILABLE stripped');
});

test('extracts typedef NS_ENUM, NS_OPTIONS, and typedef struct', () => {
  const src = `
typedef NS_ENUM(NSInteger, LogLevel) {
    LogLevelDebug = 0,
    LogLevelInfo,
    LogLevelError,
};

typedef NS_OPTIONS(NSUInteger, LayoutOptions) {
    LayoutNone = 0,
    LayoutExpand = 1 << 0,
};

typedef struct CGPoint {
    CGFloat x;
    CGFloat y;
} CGPoint;
`;
  const sigs = objc.extract(src);
  assert.ok(sigs.some((s) => s.includes('typedef NS_ENUM(NSInteger, LogLevel)')), 'NS_ENUM extracted');
  assert.ok(sigs.some((s) => s.includes('typedef NS_OPTIONS(NSUInteger, LayoutOptions)')), 'NS_OPTIONS extracted');
  assert.ok(sigs.some((s) => s.includes('typedef struct CGPoint')), 'typedef struct extracted');
});

test('extracts top-level C functions and static inline functions', () => {
  const src = `
#import <Foundation/Foundation.h>

void ResetApplicationState(NSString *reason) {
    // state reset
}

static inline CGFloat ClampValue(CGFloat val, CGFloat min, CGFloat max) {
    return val < min ? min : (val > max ? max : val);
}

@interface Dummy : NSObject
@end
`;
  const sigs = objc.extract(src);
  assert.ok(sigs.some((s) => s.includes('void ResetApplicationState(NSString *reason)')), 'C function extracted');
  assert.ok(sigs.some((s) => s.includes('static inline CGFloat ClampValue(CGFloat val, CGFloat min, CGFloat max)')), 'Static inline function extracted');
});

test('discloses member cap when container exceeds 120 methods', () => {
  let methods = '';
  for (let i = 0; i < 130; i++) {
    methods += `- (void)actionMethod${i};\n`;
  }
  const src = `
@interface BigService : NSObject
${methods}
@end
`;
  const sigs = objc.extract(src);
  assert.ok(sigs.some((s) => s.includes('… +10 more methods')), 'Member cap notice disclosed');
});

test('ObjC++ (.mm) extracts C++ classes', () => {
  const src = `
#import <Foundation/Foundation.h>

class CppEngine {
public:
    void start();
};

@interface ObjcBridge : NSObject
- (void)runEngine;
@end
`;
  const sigs = objc.extract(src, 'bridge.mm');
  assert.ok(sigs.some((s) => s.includes('class CppEngine')), 'C++ class extracted from .mm file');
  assert.ok(sigs.some((s) => s.includes('@interface ObjcBridge')), 'ObjC interface extracted');
});

// ── Dispatch & Header Delegation Tests ──────────────────────────────────────

test('dispatch: .m and .mm resolve to objc, .h resolves to cpp', () => {
  assert.strictEqual(dispatch.langFor('MyClass.m'), 'objc');
  assert.strictEqual(dispatch.langFor('MyWrapper.mm'), 'objc');
  assert.strictEqual(dispatch.langFor('MyHeader.h'), 'cpp');
  assert.strictEqual(dispatch.EXT_MAP['.m'], 'objc');
  assert.strictEqual(dispatch.EXT_MAP['.mm'], 'objc');
  assert.strictEqual(dispatch.EXT_MAP['.h'], 'cpp');
});

test('dispatch: Objective-C .h containing @interface delegates to objc', () => {
  const objcHeader = `
#ifndef Header_h
#define Header_h

@interface ServiceClient : NSObject
@property (nonatomic, copy) NSString *endpoint;
- (void)connectWithTimeout:(NSTimeInterval)timeout;
@end

#endif
`;
  const sigs = dispatch.extractFile('ServiceClient.h', objcHeader);
  assert.ok(sigs.some((s) => s.includes('@interface ServiceClient : NSObject')), 'Header delegated to objc for @interface');
  assert.ok(sigs.some((s) => s.includes('- (void)connectWithTimeout:(NSTimeInterval)timeout')), 'Method signature extracted');
});

test('dispatch: normal C/C++ .h continues using cpp', () => {
  const cppHeader = `
#ifndef CPP_HEADER_H
#define CPP_HEADER_H

class Vector3 {
public:
  double magnitude();
};

int dotProduct(Vector3 a, Vector3 b);

#endif
`;
  const sigs = dispatch.extractFile('Vector3.h', cppHeader);
  assert.ok(sigs.some((s) => s.includes('class Vector3')), 'Normal C++ class extracted');
  assert.ok(sigs.some((s) => s.includes('magnitude()')), 'C++ member function extracted');
  assert.ok(!sigs.some((s) => s.includes('@interface')), 'Should not contain ObjC markers');
});

test('dispatch: Objective-C #import in header triggers delegation to objc', () => {
  const importHeader = `
#import <Foundation/Foundation.h>

@protocol Loggable
- (void)logMessage:(NSString *)msg;
@end
`;
  const sigs = dispatch.extractFile('Loggable.h', importHeader);
  assert.ok(sigs.some((s) => s.includes('@protocol Loggable')), 'Header with #import delegated to objc');
  assert.ok(sigs.some((s) => s.includes('- (void)logMessage:(NSString *)msg')), 'Protocol method extracted');
});

console.log(`\nobjc-language tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
