import secrets
from functools import wraps
from dataclasses import dataclass, asdict

from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

app.secret_key = "d23039be98f9dc87a77a23f78abecb286e6be8bd99d46f60cd817db443cbff9c"

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD_HASH = generate_password_hash("bovini123")


def login_required(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        if not session.get("logged_in"):
            if request.path.startswith("/api/"):
                return jsonify({"error": "authentication required"}), 401
            return redirect(url_for("login", next=request.path))
        return f(*args, **kwargs)
    return wrapped

menu_options = []


@dataclass
class Food_struct:
    name: str
    description: str
    price: int
    category: int


@dataclass
class Reservation:
    id: int
    name: str
    phone: str
    party_size: int
    date: str
    time: str
    notes: str = ""
    status: str = "pending"


reservations = []
next_reservation_id = 1

did_it_succeed = True


class Food:

    def __init__(self, name, description, price, category):
        self.name = name
        self.description = description
        self.price = price
        self.category = category

        self.food = Food_struct(self.name, self.description, self.price, self.category)

    def append(self):
        global did_it_succeed
        if not self.name or not self.description or self.price is None or self.category is None:
            did_it_succeed = False
        else:
            did_it_succeed = True
            menu_options.append(self.food)

    def remove(self):
        global did_it_succeed
        index = None
        for i in range(len(menu_options)):
            if menu_options[i].name == self.name:
                index = i
                break

        if index is None:
            did_it_succeed = False
        else:
            menu_options.pop(index)
            did_it_succeed = True


@app.route('/')
def home():
    return render_template('bovini_site.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html', error=None)

    username = request.form.get('username', '')
    password = request.form.get('password', '')

    if username == ADMIN_USERNAME and check_password_hash(ADMIN_PASSWORD_HASH, password):
        session['logged_in'] = True
        session['username'] = username
        next_url = request.args.get('next') or url_for('admin')
        return redirect(next_url)

    return render_template('login.html', error="Incorrect username or password"), 401


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/admin')
@login_required
def admin():
    return render_template('admin.html', username=session.get('username', 'Admin'))


@app.route('/api/menu', methods=['GET'])
@login_required
def get_menu():
    return jsonify([asdict(item) for item in menu_options])


@app.route('/api/menu', methods=['POST'])
@login_required
def create_item():
    data = request.get_json(silent=True) or {}

    new_food = Food(
        name=data.get('name'),
        description=data.get('description'),
        price=data.get('price'),
        category=data.get('category'),
    )
    new_food.append()

    if not did_it_succeed:
        return jsonify({"error": "name, description, price, and category are all required"}), 400

    return jsonify(asdict(new_food.food)), 201


@app.route('/api/menu/<name>', methods=['PUT'])
@login_required
def update_item(name):
    existing = next((item for item in menu_options if item.name == name), None)
    if existing is None:
        return jsonify({"error": "item not found"}), 404

    data = request.get_json(silent=True) or {}
    if 'name' in data:
        existing.name = data['name']
    if 'description' in data:
        existing.description = data['description']
    if 'price' in data:
        existing.price = data['price']
    if 'category' in data:
        existing.category = data['category']

    return jsonify(asdict(existing))


@app.route('/api/menu/<name>', methods=['DELETE'])
@login_required
def delete_item(name):
    remover = Food(name=name, description="", price=0, category=0)
    remover.remove()

    if not did_it_succeed:
        return jsonify({"error": "item not found"}), 404

    return jsonify({"success": True})


@app.route('/api/settings/password', methods=['PUT'])
@login_required
def change_password():
    global ADMIN_PASSWORD_HASH

    data = request.get_json(silent=True) or {}
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not check_password_hash(ADMIN_PASSWORD_HASH, current_password):
        return jsonify({"error": "current password is incorrect"}), 400

    if not new_password or len(new_password) < 6:
        return jsonify({"error": "new password must be at least 6 characters"}), 400

    ADMIN_PASSWORD_HASH = generate_password_hash(new_password)
    return jsonify({"success": True})


@app.route('/api/reservations', methods=['GET'])
@login_required
def get_reservations():
    return jsonify([asdict(r) for r in reservations])


@app.route('/api/reservations', methods=['POST'])
@login_required
def create_reservation():
    global next_reservation_id

    data = request.get_json(silent=True) or {}
    name = data.get('name')
    phone = data.get('phone')
    party_size = data.get('party_size')
    date = data.get('date')
    time = data.get('time')

    if not name or not phone or not party_size or not date or not time:
        return jsonify({"error": "name, phone, party_size, date, and time are all required"}), 400

    try:
        party_size = int(party_size)
    except (TypeError, ValueError):
        return jsonify({"error": "party_size must be a number"}), 400

    reservation = Reservation(
        id=next_reservation_id,
        name=name,
        phone=phone,
        party_size=party_size,
        date=date,
        time=time,
        notes=data.get('notes', ''),
        status=data.get('status', 'pending'),
    )
    reservations.append(reservation)
    next_reservation_id += 1

    return jsonify(asdict(reservation)), 201


@app.route('/api/reservations/<int:reservation_id>', methods=['PUT'])
@login_required
def update_reservation(reservation_id):
    existing = next((r for r in reservations if r.id == reservation_id), None)
    if existing is None:
        return jsonify({"error": "reservation not found"}), 404

    data = request.get_json(silent=True) or {}
    if 'name' in data:
        existing.name = data['name']
    if 'phone' in data:
        existing.phone = data['phone']
    if 'party_size' in data:
        try:
            existing.party_size = int(data['party_size'])
        except (TypeError, ValueError):
            return jsonify({"error": "party_size must be a number"}), 400
    if 'date' in data:
        existing.date = data['date']
    if 'time' in data:
        existing.time = data['time']
    if 'notes' in data:
        existing.notes = data['notes']
    if 'status' in data:
        existing.status = data['status']

    return jsonify(asdict(existing))


@app.route('/api/reservations/<int:reservation_id>', methods=['DELETE'])
@login_required
def delete_reservation(reservation_id):
    existing = next((r for r in reservations if r.id == reservation_id), None)
    if existing is None:
        return jsonify({"error": "reservation not found"}), 404

    reservations.remove(existing)
    return jsonify({"success": True})


if __name__ == '__main__':
       app.run(debug=False, host='0.0.0.0', port=5000)