import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Client does not exists');
    }

    const allProducts = await this.productsRepository.findAllById(products);

    if (allProducts.length === 0) {
      throw new AppError('Not finded product');
    }

    const allProductsWithQuantity = allProducts.map(productItem => {
      const findedIndex = products.findIndex(
        item => item.id === productItem.id,
      );

      if (findedIndex === -1) {
        throw new AppError('Not finded product');
      }

      const productFinded = products[findedIndex];

      if (productItem.quantity - productFinded.quantity < 0) {
        throw new AppError('No stock for the product');
      }

      return {
        product_id: productItem.id,
        price: productItem.price,
        quantity: productFinded.quantity,
      };
    });

    const allProductsWithoutQuantity = allProducts.map(productItem => {
      const findedIndex = products.findIndex(
        item => item.id === productItem.id,
      );

      const productFinded = products[findedIndex];

      return {
        id: productFinded.id,
        quantity: productItem.quantity - productFinded.quantity,
      };
    });

    await this.productsRepository.updateQuantity(allProductsWithoutQuantity);

    const order = await this.ordersRepository.create({
      customer,
      products: allProductsWithQuantity,
    });

    return order;
  }
}

export default CreateOrderService;
