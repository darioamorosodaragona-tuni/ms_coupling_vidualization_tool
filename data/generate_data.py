import json
import random

# Input microservices data
with open("ms_data.json", "r") as input_file:
    data = json.load(input_file)

# Generate files.json (Files and their connections in Sigma.js format)
files_data = {"nodes": [], "edges": []}
file_node_id = 0
microservice_files_map = {}
store_info_files = {}

# Generate file nodes, each belonging to a microservice
for edge in data["edges"]:
    source_label = next(node["attributes"]["label"] for node in data["nodes"] if node["key"] == edge["source"])
    target_label = next(node["attributes"]["label"] for node in data["nodes"] if node["key"] == edge["target"])
    source_id = next(node["key"] for node in data["nodes"] if node["key"] == edge["source"])
    target_id = next(node["key"] for node in data["nodes"] if node["key"] == edge["target"])

    num_files = edge["attributes"]["files"]
    source_files_n = random.randint(1, num_files)  # Ensure at least one file per source
    target_files_n = num_files - source_files_n

    store_info_files[edge['key']] = {"source_files": source_files_n, "target_files": target_files_n}
    # Generate random positions for the file nodes
    x = random.uniform(0, 500)
    y = random.uniform(0, 500)

    # Create file nodes with microservice ownership
    source_files = [
        {
            "key": f"file_{file_node_id + i}",
            "attributes": {
                "x": x + random.uniform(-50, 50),  # Randomize position
                "y": y + random.uniform(-50, 50),
                "size": 28,
                "label": f"File_{i + 1}",
                "type": "file",
                "microservice_label": source_label,
                "microservice_id": source_id
            }
        }
        for i in range(source_files_n)
    ]
    target_files = [
        {
            "key": f"file_{file_node_id + source_files_n + i}",
            "attributes": {
                "x": x + random.uniform(-50, 50),
                "y": y + random.uniform(-50, 50),
                "size": 28,
                "label": f"File_{source_files_n + i + 1}",
                "type": "file",
                "microservice_label": target_label,
                "microservice_id": target_id
            }
        }
        for i in range(target_files_n)
    ]

    # Store files by their microservice
    microservice_files_map[source_label] = microservice_files_map.get(source_label, []) + source_files
    microservice_files_map[target_label] = microservice_files_map.get(target_label, []) + target_files

    files_data["nodes"].extend(source_files)
    files_data["nodes"].extend(target_files)

    file_node_id += source_files_n + target_files_n  # Increment by the number of files generated

# Generate file edges between files of connected microservices
for edge in data["edges"]:
    source_label = next(node["attributes"]["label"] for node in data["nodes"] if node["key"] == edge["source"])
    target_label = next(node["attributes"]["label"] for node in data["nodes"] if node["key"] == edge["target"])

    source_files = microservice_files_map.get(source_label, [])
    target_files = microservice_files_map.get(target_label, [])

    source_files = random.sample(source_files, store_info_files[edge['key']]["source_files"])
    target_files = random.sample(target_files, store_info_files[edge['key']]["target_files"])


    # Ensure each file has at least one connection and a maximum of 10
    for source_file in source_files:
        max_ = 0
        if len(target_files) > 10:
            max_ = 10
        else:
            max_ = len(target_files)
        connections = random.randint(1,max_ )  # Decide the number of connections
        connected_targets = random.sample(target_files, connections)

        for target_file in connected_targets:
            files_data["edges"].append(
                {
                    "key": f"file_edge_{source_file['key']}_{target_file['key']}",
                    "source": source_file["key"],
                    "target": target_file["key"],
                    "attributes": {"gravity": random.random()}
                }
            )

# Save the JSON files
with open("ms_files.json", "w") as files_file:
    json.dump(files_data, files_file, indent=4)

print("JSON files generated successfully.")
