import technical_test from "./tests/technical.json";

console.log(technical_test);

technical_test.tests.forEach((test) => {
  console.log(test.prompt);
  console.log(test.answers);
});
