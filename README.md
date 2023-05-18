# Hotel Search Application
## Table of Contents

- [About](#about)
- [Getting Started](#getting_started)
- [Installing](#installing)
- [Usage](#usage)

## About <a name = "about"></a>

A simple hotel search application, 
- Uses two microservices to perform basic semantic search.
- Uses Docker to containerize
- Uses docker-compose to run as a service on a single host.
- Uses Kubernetes on top of these microservices to create a cluster and orchestrate.
- Uses MongoDB for backend.

<br> The larger purpose of this project is to have a reusable code to quickly set up semantic search style projects using docker (compose), kubernetes and mongodb. 
<br> You can switch the backend NLP pipeline with more powerful models.

## Getting Started <a name = "getting_started"></a>

### Prerequisites

To run this project, you need to have:
1. docker or docker-desktop
2. kubernetes
3. kubectl
5. mongodb
4. Node (Optional, only if you want to run test program)
6. Compass (Optional, only if you want a GUI to view (because why not!!))
7. Postman (Optional, test endpoints easily)

Follow steps to set-up mongodb with the cluster:

https://github.com/mongodb/mongodb-kubernetes-operator/blob/master/docs/install-upgrade.md#procedure-using-kubectl

### TLDR - Get started
#### (Works with: https://github.com/mongodb/mongodb-kubernetes-operator/releases/tag/v0.8.0):

```
git clone https://github.com/mongodb/mongodb-kubernetes-operator.git
cd mongodb-kubernetes-operator
kubectl create namespace mongodb
kubectl apply -f config/crd/bases/mongodbcommunity.mongodb.com_mongodbcommunity.yaml --namespace mongodb
kubectl get crd/mongodbcommunity.mongodbcommunity.mongodb.com --namespace mongodb #Verify whether created
kubectl apply -k config/rbac/ --namespace mongodb
kubectl create -f config/manager/manager.yaml --namespace mongodb
kubectl get pods --namespace mongodb #verify pods
kubectl create secret generic hotel-password --from-literal=password=hotel_password --namespace mongodb
```

Read this for External Access (Not required if you run the mongodb service (mongodb-sv.yaml) as it exposes the service as Nodeport (probably a bad idea!!)):
https://github.com/mongodb/mongodb-kubernetes-operator/blob/master/docs/external_access.md


## Installing

1. Clone this repository: `git clone https://github.com/ps662/HotelSearchCloud.git`
2. Navigate to the project directory: `cd HotelSearchCloud/`

To start the mongodb service, run the following commands:

```
kubectl apply -f k8s/mongodb-pv.yaml --namespace mongodb
kubectl apply -f k8s/mongodb-pvc.yaml --namespace mongodb
kubectl apply -f k8s/mongodb-storage.yaml --namespace mongodb
kubectl apply -f k8s/mongodb-sv.yaml --namespace mongodb
kubectl apply -f k8s/mongodb.yaml --namespace mongodb
```

To start the server, run the following command:

```
kubectl apply -f k8s/nlp_service.yaml --namespace mongodb
kubectl apply -f k8s/nlp_deployment.yaml --namespace mongodb
kubectl apply -f k8s/search_deployment.yaml --namespace mongodb
kubectl apply -f k8s/search_service.yaml --namespace mongodb
```


To enable port forwarding (in two different shells):

```
kubectl port-forward service/search-service 3000:3000
kubectl port-forward service/nlp-service 3001:3001
```

This will start the server and listen on port 3000. You can access the application in your web browser by visiting [http://localhost:3000](http://localhost:3000).


If you also want to monitor using the dashboard then use:

```
# Change version according to your kubectl
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml
kubectl apply -f k8s/admin_dashboard.yaml
kubectl proxy
```

To generate an access token use:

```
kubectl -n kubernetes-dashboard create token admin-user
```

Navigate to http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/ and use the generated token to access the dashboard.

### Cleanup

To teardown everything and delete the resources run the following commands:

```
kubectl delete deployment nlp-service --namespace mongodb
kubectl delete service nlp-service --namespace mongodb
kubectl delete deployment search-service --namespace mongodb
kubectl delete service search-service --namespace mongodb
kubectl delete mongodbcommunity mongodb --namespace mongodb
kubectl delete service mongodb-svc --namespace mongodb
kubectl delete storageclass mongodb-storage --namespace mongodb
kubectl delete namespaces mongodb
```
## Usage <a name = "usage"></a>

You can test the application by using test/simple_test_query.js (you need node installed for this):

```
node simple_test_query.js --all
```

If you have not set up port forwarding and want a custom host then use:

```
node simple_test_query.js --all --host "http://localhost:30000" <or your custom hostname>
```

or you can use this tool to test in a more customized way:

```
node simple_test_query.js --userQuery="I want a hotel with free WiFi" --hotelId=1 --newAnnotation="This hotel has free WiFi" --numAnnotations=10 --deleteAll=true --all
```

or if you want you can test only a particular endpoint: 

```
node simple_test_query.js insert --hotelId=1 --newAnnotation="This hotel has city view"
```

### Some Tools
- You can also use [Postman](https://www.postman.com/) for testing endpoints.
- and [Compass](https://www.mongodb.com/products/compass) for viewing MongoDB stuff.
