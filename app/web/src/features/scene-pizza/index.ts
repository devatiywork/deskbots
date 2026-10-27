// Пицца: заказ (кнопка, обед — событие order-pizza), фургон, курьер, коробка на кухонный стол.
// Регистрируется в реестре сценок при загрузке модуля.
export { orderPizza, pizzaStatus, pizzaUntil, type Pizza, type PizzaStage } from './model/pizza';
export { VAN_STOP, VAN_LEN, PIZZA_TIME } from './lib/pizza';
export { drawPizza } from './ui/pizza';
export { drawVan } from './ui/van';
