let cart = JSON.parse(localStorage.getItem("cart")) || [];


// Display Cart
function displayCart() {

    const cartItems = document.getElementById("cartItems");
    const cartTotal = document.getElementById("cartTotal");

    cartItems.innerHTML = "";

    let total = 0;


    // Empty Cart
    if (cart.length === 0) {

        cartItems.innerHTML = `
            <div class="bg-white p-8 rounded-lg shadow text-center">

                <h2 class="text-xl font-semibold mb-3">
                    Your cart is empty
                </h2>

                <p class="text-gray-500 mb-5">
                    Please select some food items.
                </p>

                <a href="menu.html"
                   class="inline-block bg-blue-600 text-white px-5 py-3 rounded-lg">

                    Go to Menu

                </a>

            </div>
        `;

        cartTotal.textContent = "₹0";

        return;
    }


    // Display Cart Items
    cart.forEach((item, index) => {

        const itemTotal = item.price * item.quantity;

        total += itemTotal;


        cartItems.innerHTML += `
            <div class="bg-white p-5 rounded-lg shadow mb-4">

                <div class="flex justify-between items-center">

                    <div>

                        <h2 class="text-xl font-bold">
                            ${item.name}
                        </h2>

                        <p class="text-gray-600">
                            ₹${item.price} per item
                        </p>


                        <!-- Quantity -->
                        <div class="flex items-center gap-3 mt-4">

                            <button
                                onclick="decreaseQuantity(${index})"
                                class="bg-gray-300 px-4 py-2 rounded-lg text-xl">
                                −
                            </button>

                            <span class="text-lg font-bold">
                                ${item.quantity}
                            </span>

                            <button
                                onclick="increaseQuantity(${index})"
                                class="bg-blue-600 text-white px-4 py-2 rounded-lg text-xl">
                                +
                            </button>

                        </div>


                        <p class="font-semibold mt-3">
                            Item Total: ₹${itemTotal}
                        </p>

                    </div>


                    <button
                        onclick="removeItem(${index})"
                        class="bg-red-500 text-white px-4 py-2 rounded-lg">
                        Remove
                    </button>

                </div>

            </div>
        `;
    });


    // Total
    cartTotal.textContent = `₹${total}`;
}


// Increase Quantity
function increaseQuantity(index) {

    cart[index].quantity++;

    localStorage.setItem("cart", JSON.stringify(cart));

    displayCart();
}


// Decrease Quantity
function decreaseQuantity(index) {

    if (cart[index].quantity > 1) {

        cart[index].quantity--;

    } else {

        cart.splice(index, 1);

    }

    localStorage.setItem("cart", JSON.stringify(cart));

    displayCart();
}


// Remove Item
function removeItem(index) {

    cart.splice(index, 1);

    localStorage.setItem("cart", JSON.stringify(cart));

    displayCart();
}

// Proceed to Order

function proceedToOrder() {

    if (cart.length === 0) {

        alert("Your cart is empty!");

        return;
    }

    window.location.href = "order.html";
}

// Load Cart
displayCart();

function logout() {
    localStorage.removeItem("student");
    localStorage.removeItem("user_id");
    window.location.href = "login.html";
}

const student = localStorage.getItem("student");

const authLink = document.getElementById("authLink");

if (student) {
    authLink.innerHTML = `
        <button
            onclick="logout()"
            class="text-red-600 font-semibold">
            Logout
        </button>
    `;
} else {
    authLink.innerHTML = `
        <a href="login.html"
           class="text-gray-700">
            Login
        </a>
    `;
}
