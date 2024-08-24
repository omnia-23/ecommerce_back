import Cart from "../../../../DB/models/Cart.js";
import Order from "../../../../DB/models/Order.js";
import Product from "../../../../DB/models/Product.js";
import asyncHandler from "../../../middleware/asyncHandler.js";
import AppError from "../../../utils/AppError.js";

import Stripe from "stripe";

const stripe = new Stripe(
  "sk_test_51PokU9AXaj6VSZsVYsubHy4RarfN6W5azi0mSSOgPXK1B2qPDE2Itx3ho7FtrVs3z60kyKqf0BQ9EjQcb2Nzw7MW00Z3btADVB"
);

export const addCashOrder = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user.id });
  console.log(cart);
  if (!cart) {
    return next(new AppError("Cart not found", 404));
  }

  if (!cart.products.length) {
    return next(new AppError("Cart is empty", 400));
  }

  // Verify stock availability
  const products = cart.products;
  const verificationPromises = products.map(async (element) => {
    const product = await Product.findById(element.product);
    if (!product) {
      throw new AppError(`Product ${element.product} not found`, 404);
    }
    if (product.stock < element.quantity) {
      throw new AppError(
        `Insufficient stock for product ${element.product}. Available: ${product.stock}`,
        400
      );
    }
  });

  await Promise.all(verificationPromises);
  const updatePromises = products.map(async (element) => {
    await Product.findByIdAndUpdate(element.product, {
      $inc: { sold: element.quantity, stock: -element.quantity },
    });
  });

  await Promise.all(updatePromises);

  req.body.products = products;
  req.body.total = cart.total;
  req.body.user = req.user.id;
  const order = new Order(req.body);
  await order.save();
  await Cart.findOneAndDelete({ user: req.user.id });

  if ((req.body.paymentMethod = "card")) {
    const YOUR_DOMAIN = "http://localhost:4242";

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "egp",
            unit_amount: order.total * 100,
            product_data: {
              name: "test",
              description: "desc",
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${YOUR_DOMAIN}?success=true`,
      cancel_url: `${YOUR_DOMAIN}?canceled=true`,
      client_reference_id: req.user.id,
      metadata: {
        order_id: order._id.toString(),
      },
    });

    return res.status(200).json({ session });
  }

  return res.status(201).json({ message: "success", order, status: 201 });
});
