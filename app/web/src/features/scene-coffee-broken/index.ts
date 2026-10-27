// Поломка кофемашины: регистрируется в реестре сценок при загрузке модуля.
// drawCoffeeFx — дым и «!» над машиной, в кадр сразу после живого на стенах (drawWallLive).
export { coffeeFail, coffeeFx, coffeeStep, type CoffeeFail, type CoffeeStage } from './model/coffee';
export { drawCoffeeFx } from './ui/drawCoffee';
