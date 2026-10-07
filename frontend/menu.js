let cart = JSON.parse(localStorage.getItem("cart")) || [];

function addToCart(id, name, price) {

    const existingItem = cart.find(item => item.id === id);

    if (existingItem) {

        existingItem.quantity =
            existingItem.quantity + 1;

    } else {

        cart.push({
            id: id,
            name: name,
            price: price,
            quantity: 1
        });

    }

    localStorage.setItem(
        "cart",
        JSON.stringify(cart)
    );

    alert(name + " added to cart!");
}